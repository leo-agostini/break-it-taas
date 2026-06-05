import { describe, expect, it } from 'bun:test';

const baseUrl =
  process.env.INTEGRATION_BASE_URL ?? 'http://api.127.0.0.1.sslip.io:8080';
const kubeContext =
  process.env.INTEGRATION_KUBECONFIG_CONTEXT ?? 'k3d-workload';
const dbNamespace = process.env.INTEGRATION_DB_NAMESPACE ?? 'data';
const dbStatefulSet = process.env.INTEGRATION_DB_STATEFULSET ?? 'postgres';
const dbName = process.env.INTEGRATION_DB_NAME ?? 'taas';
const dbUser = process.env.INTEGRATION_DB_USER ?? 'appuser';
const targetNamespace = process.env.INTEGRATION_TARGET_NAMESPACE ?? 'app';
const targetLabelSelector =
  process.env.INTEGRATION_TARGET_LABEL_SELECTOR ?? 'app=load-target';
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
const executionTimeoutSeconds = Number(
  process.env.INTEGRATION_EXECUTION_TIMEOUT_SECONDS ?? '30',
);

const shouldRun = process.env.RUN_K3S_INTEGRATION === '1';
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
  const payload = (await response.json()) as { token: string };
  expect(payload.token.length).toBeGreaterThan(10);
  return payload.token;
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
        baseUrl: 'http://load-target.app.svc.cluster.local:8080',
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

function parseCpuToMilli(cpuValue: string): number {
  if (cpuValue.endsWith('m')) {
    return Number(cpuValue.slice(0, -1));
  }
  return Number(cpuValue) * 1000;
}

async function getTargetPodMaxCpuMilli(): Promise<number | null> {
  const out = tryRunCommand([
    'kubectl',
    '--context',
    kubeContext,
    '-n',
    targetNamespace,
    'top',
    'pod',
    '-l',
    targetLabelSelector,
    '--no-headers',
  ]);

  if (!out) {
    return null;
  }

  const lines = out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  let maxCpuMilli = 0;
  for (const line of lines) {
    const columns = line.split(/\s+/);
    if (columns.length < 2) {
      continue;
    }
    const cpuMilli = parseCpuToMilli(columns[1]);
    if (Number.isFinite(cpuMilli)) {
      maxCpuMilli = Math.max(maxCpuMilli, cpuMilli);
    }
  }

  return maxCpuMilli > 0 ? maxCpuMilli : null;
}

async function getRunStatus(runId: string): Promise<TestRunStatus> {
  const sql = `select status from test_runs where id='${runId}'`;
  const out = runCommand([
    'kubectl',
    '--context',
    kubeContext,
    '-n',
    dbNamespace,
    'exec',
    `statefulset/${dbStatefulSet}`,
    '--',
    'psql',
    '-U',
    dbUser,
    '-d',
    dbName,
    '-t',
    '-A',
    '-c',
    sql,
  ]);

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
  const sql = `select count(*) from results where test_run_id='${runId}'`;
  const out = runCommand([
    'kubectl',
    '--context',
    kubeContext,
    '-n',
    dbNamespace,
    'exec',
    `statefulset/${dbStatefulSet}`,
    '--',
    'psql',
    '-U',
    dbUser,
    '-d',
    dbName,
    '-t',
    '-A',
    '-c',
    sql,
  ]);

  return Number(out) > 0;
}

suite('k3s test run integration flow', () => {
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
          getTargetPodMaxCpuMilli(),
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
});
