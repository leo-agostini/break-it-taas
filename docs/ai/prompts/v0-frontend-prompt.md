# Break-It — v0 Frontend Prompt

A paste-ready prompt for **v0 (Vercel)** to generate the frontend for the `break-it-taas`
load-testing platform. **Mock data first** (no backend wiring), but data access is kept behind
a typed `lib/api.ts` so the real API can be dropped in later.

The domain shapes below are taken verbatim from the backend:
- `backend/src/domain/entities/test-case.ts`, `test-run.ts`
- `backend/src/domain/vos/*`
- `backend/src/application/repositories/test-run-metrics-repository.ts`

---

## Prompt — copy everything below into v0

Build a **Load Testing dashboard** web app called **Break-It**.

**Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts.
Use **mock/in-memory data only** — no backend, no `fetch`. Keep all data access behind a small
typed `lib/api.ts` module exposing `async` functions (e.g. `listTestCases`, `getTestCase`,
`createTestCase`, `listRuns`, `createRun`, `getRunReport`) so a real API can replace the mock
later. Dark, technical aesthetic suitable for an SRE / performance-engineering tool. Sidebar nav.

### Screens & routes

1. **`/login`** — email + password form, "Sign in" button, logo, link to sign up. On submit,
   fake-auth and route to `/test-cases`. Gate the app behind a simple mock auth context.

2. **`/test-cases`** — table/grid of test cases: name, `testType` badge, target
   `baseUrl` / `environment`, `createdAt`, run count. "New test case" button → `/test-cases/new`.

3. **`/test-cases/new`** — create form, grouped in sections:
   - **Basics:** name, description, `testType` select (`SPIKE`, `STRESS`, `SMOKE`, `AVG_LOAD`, `SOAK`, `BREAKPOINT`).
   - **Target system:** `baseUrl`, `environment`.
   - **Auth strategy:** `kind` select (`NONE`, `BEARER_TOKEN`, `BASIC_AUTH`, `API_KEY_HEADER`, `LOGIN_FLOW`) with conditional fields per kind.
   - **Load profile:** `mode` (`CONSTANT` | `RAMP`). `CONSTANT` → `targetRate`, `duration`, `timeUnit` (`SECONDS`/`MINUTES`/`HOURS`). `RAMP` → `initialRate`, `timeUnit`, `stages[]` (each: `target`, `duration`).
   - **Thresholds:** `maxErrorRate` (0–1), `maxP95ResponseTimeMs`, `maxP99ResponseTimeMs`, `minCheckSuccessRate` (0–1), `abortOnFail` toggle.
   - **Execution:** `resourceProfile` (`SMALL`/`MEDIUM`/`LARGE`/`CUSTOM`), `timeoutSeconds`, optional `cpuMillicores`, `memoryMb`.
   - **API contract / steps:** a repeatable list of HTTP steps — `method` (`GET`/`POST`/`PUT`/`DELETE`), `path`, optional `headers`, optional JSON `body`, and `checks[]`:
     - `STATUS_CODE` → `expected` (number)
     - `RESPONSE_TIME_LT` → `maxMs` (number)
     - `BODY_CONTAINS` → `value` (string)
     - `JSON_PATH_EQUALS` → `path` + `expected` (string|number|boolean)

     Also provide an **"Advanced" JSON textarea** to paste the whole steps array at once.

4. **`/test-cases/[id]`** — test case detail:
   - Header: name, `testType` badge, target, threshold summary.
   - **"New test run"** button: creates a mock run in `CREATED` status, optimistically appended to the table; simulate it progressing `CREATED → QUEUED → RUNNING → SUCCEEDED` over a few seconds.
   - **Test runs table:** columns — short `id`, `status` (colored badge per status), `createdAt`, `startedAt`, `completedAt`, duration, `p95Ms`, `successRate`, `achievedRps`. Row click selects the run for comparison / opens its report.
   - Warning chips on runs where `generatorLimited` or `timeoutsDetected` is true.
   - **Metrics comparison** section (Recharts) comparing the runs of this case, with checkboxes to choose which runs to overlay:
     - Bar: `p95Ms` vs `p99Ms` vs `medianMs` per run.
     - Bar/line: `achievedRps` vs `requestedRate` per run (highlights generator-limited).
     - Bar: `successRate` / `failureRate` per run (0–100%).
     - Bar: `totalRequests` and `droppedIterations` per run.

5. **`/test-cases/[id]/runs/[runId]`** *(optional)* — single run report: metric cards for every
   field below + an artifacts list.

### Status colors (`TestRunStatus`)
`CREATED` (gray), `QUEUED` (blue), `RUNNING` (amber/pulsing), `SUCCEEDED` (green),
`FAILED` (red), `TIMEOUT` (orange), `CANCELLED` (slate).

### Types — mirror exactly in `lib/types.ts`

```ts
// enums
type TestType = 'SPIKE' | 'STRESS' | 'SMOKE' | 'AVG_LOAD' | 'SOAK' | 'BREAKPOINT';
type TestCaseOwnerType = 'USER' | 'ORGANIZATION';
type AuthStrategyKind = 'NONE' | 'BEARER_TOKEN' | 'BASIC_AUTH' | 'API_KEY_HEADER' | 'LOGIN_FLOW';
type LoadMode = 'CONSTANT' | 'RAMP';
type TimeUnit = 'SECONDS' | 'MINUTES' | 'HOURS';
type ResourceProfile = 'SMALL' | 'MEDIUM' | 'LARGE' | 'CUSTOM';
type TestRunStatus =
  | 'CREATED' | 'QUEUED' | 'RUNNING'
  | 'SUCCEEDED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type CheckKind = 'STATUS_CODE' | 'RESPONSE_TIME_LT' | 'BODY_CONTAINS' | 'JSON_PATH_EQUALS';

type StepCheck =
  | { kind: 'STATUS_CODE'; expected: number }
  | { kind: 'RESPONSE_TIME_LT'; maxMs: number }
  | { kind: 'BODY_CONTAINS'; value: string }
  | { kind: 'JSON_PATH_EQUALS'; path: string; expected: string | number | boolean };

interface Step {
  path: string;
  method: HttpMethod;
  checks: StepCheck[];
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface TestCase {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  ownerType: TestCaseOwnerType;
  ownerId: string;
  testType: TestType;
  targetSystem: { baseUrl: string; environment: string };
  authStrategy: { kind: AuthStrategyKind; [k: string]: unknown };
  loadProfile:
    | { mode: 'CONSTANT'; config: { targetRate: number; duration: number; timeUnit: TimeUnit } }
    | { mode: 'RAMP'; config: { initialRate: number; timeUnit: TimeUnit; stages: { target: number; duration: number }[] } };
  thresholdPolicy: {
    maxErrorRate?: number;
    maxP95ResponseTimeMs?: number;
    maxP99ResponseTimeMs?: number;
    minCheckSuccessRate?: number;
    abortOnFail: boolean;
  };
  executionPolicy: {
    resourceProfile: ResourceProfile;
    timeoutSeconds: number;
    cpuMillicores?: number;
    memoryMb?: number;
  };
  steps: Step[];
}

interface TestRun {
  id: string;
  testCaseId: string;
  createdAt: string;
  status: TestRunStatus;
  startedAt?: string;
  completedAt?: string;
  runtimeRef?: string;
  artifacts?: string[];
}

interface TestRunMetrics {
  testRunId: string;
  status: TestRunStatus;
  completedAt?: string;
  requestedRate?: number;
  requestedTimeUnit?: string;
  requestedDurationSeconds?: number;
  achievedRps?: number;
  totalRequests?: number;
  droppedIterations?: number;
  failureRate?: number;   // 0..1
  successRate?: number;   // 0..1
  p95Ms?: number;
  p99Ms?: number;
  medianMs?: number;
  generatorLimited: boolean;
  timeoutsDetected: boolean;
}
```

### Mock data
Seed ~4 test cases across different `testType`s, each with ~5–8 runs of varied statuses and
realistic metrics: `p95Ms` 50–800, `successRate` 0.90–1.0, `achievedRps` near or below
`requestedRate`, a couple with `generatorLimited` / `timeoutsDetected` = true, and at least one
`FAILED` and one `TIMEOUT` run.

### UX
Color-coded status badges, loading/empty states, responsive layout, sidebar nav (Test Cases).
Clean and fast.
