import { describe, expect, it } from 'bun:test';

const baseUrl = process.env.INTEGRATION_BASE_URL ?? 'http://localhost:3001';
const kubeContext =
  process.env.INTEGRATION_KUBECONFIG_CONTEXT ?? 'kind-taas-dev';
// PostgreSQL lives outside the cluster (Docker Compose locally), so the suite
// connects to it directly rather than exec'ing into an in-cluster StatefulSet.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/app';
// The load target runs in Docker Compose, so it is measured with `docker
// stats` rather than `kubectl top`.
const targetContainer =
  process.env.INTEGRATION_TARGET_CONTAINER ?? 'breakit-load-target';
const requireSaturation = process.env.INTEGRATION_REQUIRE_SATURATION === '1';
const targetCpuLimitMilli = Number(
  process.env.INTEGRATION_TARGET_CPU_LIMIT_MILLI ?? '20',
);
const targetLoadRate = Number(process.env.INTEGRATION_TARGET_RATE ?? '50');
const testDurationSeconds = Number(
  process.env.INTEGRATION_TEST_DURATION_SECONDS ?? '20',
);
const executionResourceProfile =
  process.env.INTEGRATION_EXECUTION_RESOURCE_PROFILE ?? 'SMALL';
// Must cover the load profile plus the runner's startup grace, or the API
// rejects the test case (the Job's activeDeadlineSeconds would kill the run
// before it finished).
const executionTimeoutSeconds = Number(
  process.env.INTEGRATION_EXECUTION_TIMEOUT_SECONDS ?? '90',
);

// Runner pods run in the cluster and cannot reach localhost, so they address
// the Compose load target through the kind network's host gateway. Resolved at
// run time because the subnet is assigned by Docker, not fixed.
function resolveTargetBaseUrl(): string {
  const configured = process.env.INTEGRATION_TARGET_BASE_URL;
  if (configured) {
    return configured;
  }

  // The kind network has both an IPv6 and an IPv4 subnet, and ranging over
  // IPAM.Config joins the two gateways with no separator. Print one per line
  // and keep the IPv4 one, which is the address host-published ports bind on.
  const gateways = tryRunCommand([
    'docker',
    'network',
    'inspect',
    process.env.KIND_NETWORK ?? 'kind',
    '--format',
    '{{range .IPAM.Config}}{{if .Gateway}}{{println .Gateway}}{{end}}{{end}}',
  ]);

  const gateway = gateways
    ?.split('\n')
    .map((line) => line.trim())
    .find((line) => /^\d+(\.\d+){3}$/.test(line));

  if (!gateway) {
    throw new Error(
      'Could not resolve the kind network gateway for the load target. ' +
        'Set INTEGRATION_TARGET_BASE_URL explicitly.',
    );
  }

  return `http://${gateway}:${process.env.INTEGRATION_TARGET_PORT ?? '8080'}`;
}

const shouldRun = process.env.RUN_CLUSTER_INTEGRATION === '1';
const suite = shouldRun ? describe : describe.skip;

type TestRunStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED';

const terminalStatuses = new Set<TestRunStatus>([
  'SUCCEEDED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
]);

function runCommand(command: string[]): string {
  const proc = Bun.spawnSync(command, {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr).trim();
    throw new Error(`Command failed: ${command.join(' ')}\n${stderr}`);
  }

  return new TextDecoder().decode(proc.stdout).trim();
}

function tryRunCommand(command: string[]): string | null {
  const proc = Bun.spawnSync(command, {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (proc.exitCode !== 0) {
    return null;
  }

  return new TextDecoder().decode(proc.stdout).trim();
}

async function poll<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 90000,
  intervalMs = 2000,
): Promise<T> {
  const start = Date.now();
  let latest = await fn();

  while (!predicate(latest)) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Polling timeout after ${timeoutMs}ms. Last value: ${JSON.stringify(latest)}`,
      );
    }
    await Bun.sleep(intervalMs);
    latest = await fn();
  }

  return latest;
}

async function signup(email: string) {
  const response = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Integration User',
      nickname: `int-${Date.now()}`,
      email,
      password: 'StrongPass!2345',
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
}

async function signin(email: string) {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'StrongPass!2345' }),
  });
  expect(response.status).toBe(200);
  const accessCookie = response.headers
    .getSetCookie()
    .find((c) => c.startsWith('access_token='));
  const token = accessCookie
    ? decodeURIComponent(
        accessCookie.split(';')[0].slice('access_token='.length),
      )
    : '';
  expect(token.length).toBeGreaterThan(10);
  return token;
}

async function createTestCase(token: string, ownerId: string) {
  const response = await fetch(`${baseUrl}/api/test-cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Integration Flow Smoke',
      description: 'integration flow',
      ownerType: 'USER',
      ownerId,
      testType: 'SMOKE',
      targetSystem: {
        baseUrl: resolveTargetBaseUrl(),
        environment: 'staging',
      },
      authStrategy: { kind: 'NONE' },
      loadProfile: {
        mode: 'CONSTANT',
        config: {
          duration: testDurationSeconds,
          targetRate: targetLoadRate,
          timeUnit: 'SECONDS',
        },
      },
      thresholdPolicy: { abortOnFail: false },
      executionPolicy: {
        resourceProfile: executionResourceProfile,
        timeoutSeconds: executionTimeoutSeconds,
      },
      steps: [
        {
          path: '/',
          method: 'GET',
          checks: [
            {
              kind: 'STATUS_CODE',
              expected: 200,
            },
          ],
        },
      ],
    }),
  });

  expect(response.status).toBe(201);

  return (await response.json()) as {
    testCaseId: string;
    testRunId: string;
  };
}

async function getTargetCpuMilli(): Promise<number | null> {
  // `docker stats` reports CPU as a percentage of one core, so 12.5% is
  // 125 millicores in the same units the Kubernetes-based check used.
  const out = tryRunCommand([
    'docker',
    'stats',
    '--no-stream',
    '--format',
    '{{.CPUPerc}}',
    targetContainer,
  ]);

  if (!out) {
    return null;
  }

  const percent = Number(out.trim().replace('%', ''));
  if (!Number.isFinite(percent)) {
    return null;
  }

  const cpuMilli = percent * 10;
  return cpuMilli > 0 ? cpuMilli : null;
}

async function querySingleValue(sql: string): Promise<string> {
  // Uses knex (already a backend dependency, and typed) rather than the raw pg
  // client, which ships no types. A short-lived instance per query keeps the
  // suite from leaking a connection pool.
  const { default: knex } = await import('knex');
  const client = knex({ client: 'pg', connection: databaseUrl });
  try {
    const result = await client.raw(sql);
    const row = result.rows[0];
    return row ? String(Object.values(row)[0]) : '';
  } finally {
    await client.destroy();
  }
}

async function getRunStatus(runId: string): Promise<TestRunStatus> {
  const out = await querySingleValue(
    `select status from test_runs where id='${runId}'`,
  );

  return out as TestRunStatus;
}

async function podExists(runId: string): Promise<boolean> {
  const out = runCommand([
    'kubectl',
    '--context',
    kubeContext,
    '-n',
    'app',
    'get',
    'pods',
    '-l',
    `breakit/test-run-id=${runId}`,
    '--no-headers',
  ]);

  return out.length > 0;
}

async function resultExists(runId: string): Promise<boolean> {
  const out = await querySingleValue(
    `select count(*) from results where test_run_id='${runId}'`,
  );

  return Number(out) > 0;
}

async function createTypedTestCase(
  token: string,
  ownerId: string,
  overrides: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}/api/test-cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Integration Typed Run',
      description: 'per-type integration flow',
      ownerType: 'USER',
      ownerId,
      targetSystem: {
        baseUrl: resolveTargetBaseUrl(),
        environment: 'staging',
      },
      authStrategy: { kind: 'NONE' },
      thresholdPolicy: { abortOnFail: false },
      executionPolicy: {
        resourceProfile: executionResourceProfile,
        timeoutSeconds: executionTimeoutSeconds,
      },
      steps: [
        {
          path: '/',
          method: 'GET',
          checks: [{ kind: 'STATUS_CODE', expected: 200 }],
        },
      ],
      ...overrides,
    }),
  });

  const body = (await response.json()) as {
    testCaseId?: string;
    testRunId?: string;
    error?: { message?: string };
  };
  expect(response.status).toBe(201);

  return body as { testCaseId: string; testRunId: string };
}

async function readLoadProfile(testCaseId: string): Promise<{
  mode: string;
  config: { stages?: Array<{ target: number; duration: number }> };
}> {
  const raw = await querySingleValue(
    `select load_profile::text from test_cases where id='${testCaseId}'`,
  );
  return JSON.parse(raw);
}

async function readMetricsRow(
  runId: string,
): Promise<{ aborted: boolean; breakingPointRate: number | null }> {
  const aborted = await querySingleValue(
    `select aborted from test_run_metrics where test_run_id='${runId}'`,
  );
  const breakingPointRate = await querySingleValue(
    `select coalesce(breaking_point_rate::text, '') from test_run_metrics where test_run_id='${runId}'`,
  );

  return {
    aborted: aborted === 'true',
    breakingPointRate: breakingPointRate ? Number(breakingPointRate) : null,
  };
}

suite('cluster test run integration flow', () => {
  it('runs signup->signin->test-case and finishes with runner pod + callback result', async () => {
    const email = `int-${Date.now()}@example.com`;

    const user = await signup(email);
    const token = await signin(email);
    const created = await createTestCase(token, user.id);

    const firstStatus = await poll(
      () => getRunStatus(created.testRunId),
      (status) => status === 'QUEUED' || status === 'RUNNING',
      30000,
      1500,
    );
    expect(['QUEUED', 'RUNNING']).toContain(firstStatus);

    const hasPod = await poll(
      () => podExists(created.testRunId),
      Boolean,
      60000,
      2000,
    );
    expect(hasPod).toBe(true);

    let observedPeakCpuMilli = 0;

    const terminal = await poll(
      async () => {
        const [status, sampledCpu] = await Promise.all([
          getRunStatus(created.testRunId),
          getTargetCpuMilli(),
        ]);
        if (sampledCpu !== null) {
          observedPeakCpuMilli = Math.max(observedPeakCpuMilli, sampledCpu);
        }
        return status;
      },
      (status) => terminalStatuses.has(status),
      120000,
      3000,
    );
    expect(terminalStatuses.has(terminal)).toBe(true);

    const hasResult = await poll(
      () => resultExists(created.testRunId),
      Boolean,
      60000,
      2000,
    );
    expect(hasResult).toBe(true);

    if (requireSaturation) {
      const saturationRatio = observedPeakCpuMilli / targetCpuLimitMilli;
      expect(saturationRatio).toBeGreaterThanOrEqual(0.98);
    }
  }, 180000);

  it('runs a SPIKE derived from a preset with no plateau stage', async () => {
    const email = `int-spike-${Date.now()}@example.com`;
    const user = await signup(email);
    const token = await signin(email);

    const created = await createTypedTestCase(token, user.id, {
      testType: 'SPIKE',
      loadPreset: {
        peakRate: targetLoadRate,
        duration: 30,
        timeUnit: 'SECONDS',
      },
      executionPolicy: {
        resourceProfile: executionResourceProfile,
        timeoutSeconds: 120,
      },
    });

    // A spike ramps to the peak and comes straight back down.
    const loadProfile = await readLoadProfile(created.testCaseId);
    expect(loadProfile.mode).toBe('RAMP');
    expect(loadProfile.config.stages).toHaveLength(2);
    expect(loadProfile.config.stages?.[1]?.target).toBe(0);

    const hasPod = await poll(
      () => podExists(created.testRunId),
      Boolean,
      60000,
      2000,
    );
    expect(hasPod).toBe(true);

    const terminal = await poll(
      () => getRunStatus(created.testRunId),
      (status) => terminalStatuses.has(status),
      150000,
      3000,
    );
    expect(terminalStatuses.has(terminal)).toBe(true);
  }, 240000);

  it('stops a BREAKPOINT run at its breaking point and records the rate', async () => {
    const email = `int-bp-${Date.now()}@example.com`;
    const user = await signup(email);
    const token = await signin(email);

    const created = await createTypedTestCase(token, user.id, {
      testType: 'BREAKPOINT',
      loadPreset: {
        peakRate: targetLoadRate * 20,
        duration: 60,
        timeUnit: 'SECONDS',
      },
      // A latency ceiling the CPU-limited load target cannot hold as the ramp
      // climbs, so k6 aborts partway through instead of running to the end.
      thresholdPolicy: { maxP95ResponseTimeMs: 5, abortOnFail: true },
      executionPolicy: {
        resourceProfile: executionResourceProfile,
        timeoutSeconds: 150,
      },
    });

    const terminal = await poll(
      () => getRunStatus(created.testRunId),
      (status) => terminalStatuses.has(status),
      180000,
      3000,
    );
    expect(terminalStatuses.has(terminal)).toBe(true);

    const hasResult = await poll(
      () => resultExists(created.testRunId),
      Boolean,
      60000,
      2000,
    );
    expect(hasResult).toBe(true);

    const metrics = await readMetricsRow(created.testRunId);
    expect(metrics.aborted).toBe(true);
    expect(metrics.breakingPointRate).toBeGreaterThan(0);
  }, 300000);
});
