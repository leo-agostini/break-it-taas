# Break It TaaS

## About The Project

Break It TaaS is a test-as-a-service application for defining load test cases, dispatching Kubernetes runner jobs, hitting a target API, and collecting signed runner callbacks/results.

Local development is one command: `./ops/dev-up.sh` (or `make up`).

Almost everything runs in Docker Compose — the API, the frontend, PostgreSQL, and the load target the tests hit. Only two things live outside it. The **outbox worker** runs on your host, because it dispatches Kubernetes Jobs and needs your kubeconfig. The **k6 runner Jobs** run in a local [kind](https://kind.sigs.k8s.io/) cluster, because dispatching Jobs is what the product does; there is no Compose-backed queue to fall back on.

The cluster is named `taas-dev`, with kubectl context `kind-taas-dev`. It runs *only* runner Jobs — nothing is served from it into the host, so it needs no ingress controller and no published ports. kind replaced k3d so that local scheduling behavior predicts a managed cluster's; see [ADR-005](docs/03-decisions/ADR-005-kind-over-k3d-for-local-cluster.md).

Note that kind's default CNI (kindnetd) accepts `NetworkPolicy` objects but does not enforce them. Do not use this cluster to validate network isolation.

The repository is an npm workspace with `backend/` and `frontend/` applications plus `ops/` scripts for local Kubernetes workflows.

## Tech Stack

Frontend:

- React 19
- React Router 7
- Vite
- Tailwind CSS
- Radix UI
- SWR
- Jotai
- Axios

Backend:

- Bun
- Elysia
- PostgreSQL with Knex
- Zod
- JWT
- Kubernetes client
- k6 runner jobs

## Prerequisites

- Node.js 22+
- npm 11+
- Bun 1.2+
- Docker
- PostgreSQL 16, Docker Compose, or in-cluster PostgreSQL
- kubectl
- kind
- curl
- make (optional; the Makefile targets wrap the `ops/` scripts)

## Install Dependencies

Run from the repository root:

```bash
npm install
```

If shell scripts are not executable in your checkout, make them executable once:

```bash
chmod +x ops/*.sh ops/kind/*.sh ops/k8s/*.sh
```

## Run Everything

One command brings up the whole environment and leaves the outbox worker
running in the foreground:

```bash
./ops/dev-up.sh          # or: make up
```

It does five things, in order:

1. creates the kind cluster if it does not exist, and applies the `app` and
   `tests` namespaces
2. builds the k6 runner image and loads it into the cluster
3. starts the Compose stack — API, frontend, PostgreSQL, and the load target
4. waits for the API to report healthy
5. runs the outbox worker on your machine, in the foreground

Ctrl-C stops the worker and leaves everything else up. To tear down:

```bash
./ops/dev-down.sh              # stop Compose, keep the cluster
./ops/dev-down.sh --cluster    # also delete the cluster
./ops/dev-down.sh --volumes    # also drop the PostgreSQL volume
```

Pass `SKIP_WORKER=1` if you want the stack without the worker attached — useful
when you would rather run it from your editor or a debugger.

### Where each piece runs

| Piece | Runs in | Reachable at |
| --- | --- | --- |
| API | Docker Compose | `http://localhost:3001` |
| Frontend | Docker Compose | `http://localhost:3000` |
| PostgreSQL | Docker Compose | `postgres://postgres:postgres@localhost:5432/app` |
| Load target (the API under test) | Docker Compose | `http://localhost:8080` |
| k6 runner Jobs | kind cluster `taas-dev` | namespace `app` |
| Outbox worker | your host | — |

The worker is the one piece that cannot run in Compose: it dispatches
Kubernetes Jobs, so it needs your kubeconfig. That is the whole reason
`dev-up.sh` ends by starting it rather than handing the job to Compose.

The cluster runs *only* runner Jobs. Nothing is served from it into the host, so
it needs no ingress controller, no load balancer, and no published ports.

### How runner pods reach the host

Runner pods run inside the cluster and cannot reach `localhost`. Both things
they call — the callback endpoint on the API, and the load target — are
published on the host, so they go through the kind network's gateway (usually
`172.18.0.1`, assigned by Docker rather than fixed). `dev-up.sh` resolves that
address and prints it; the integration suite resolves it the same way.

If callbacks are not arriving, probe the path directly:

```bash
bash ops/kind/probe-callback.sh
```

### Running pieces by hand

The API and frontend are ordinary Compose services:

```bash
docker compose up -d postgres backend
docker compose logs -f backend
```

To run the API from source instead of the image, stop the Compose service and
use the workspace script:

```bash
docker compose stop backend
npm run api
```

Migrations run from the host against `DATABASE_URL`:

```bash
npm --workspace backend run migrate:latest
```

### Backend environment

`backend/.env` drives the host-run worker and the integration suite. Copy
`backend/.env.example` and fill in the secrets. Required values:

```bash
JWT_SECRET=...
JWT_REFRESH_SECRET=...
RUNNER_SHARED_SECRET=...
RUNNER_CALLBACK_BASE_URL=http://<kind-gateway>:3001
DATABASE_URL=postgres://postgres:postgres@localhost:5432/app
```

Optional values:

- `PORT` defaults to `3001`.
- `KUBERNETES_CONTEXT` has no default and must be set (`kind-taas-dev` locally). The worker fails at startup rather than silently dispatching Jobs to kubectl's current context. `dev-up.sh` sets it for you.
- `KUBERNETES_NAMESPACE` defaults to `app`.
- `KUBERNETES_QUEUE_ENDPOINT` is optional.
- `RUNNER_IMAGE` defaults to `breakit-k6-runner:local`.
- `RUNNER_RUNTIME_CLASS` and `RUNNER_NODE_SELECTOR` are empty locally; managed clusters use them to pin runner pods (e.g. GKE Sandbox: `gvisor` with `sandbox.gke.io/runtime=gvisor`).
- `JWT_ACCESS_TTL` defaults to `15m`, `JWT_REFRESH_TTL` to `7d`.
- `CORS_ORIGIN` defaults to `*`, `COOKIE_SECURE` to `false`, `COOKIE_SAMESITE` to `Lax`, `COOKIE_DOMAIN` is unset.


## Run The Frontend

For local frontend development against a local backend:

```bash
export VITE_API_URL='/api'
export VITE_API_PROXY_TARGET='http://localhost:3001'
npm --workspace frontend run dev
```

For a production-style local frontend run:

```bash
npm --workspace frontend run build
npm --workspace frontend run start
```

The frontend is never deployed to the cluster — `ops/dev-up.sh` serves it from Compose on `http://localhost:3000`. To run just that service:

```bash
docker compose up -d frontend
```

It builds from the repo root, because `frontend/Dockerfile` copies `tsconfig.base.json` from the workspace root.

## Ops Scripts

| Script | Purpose | When to run | Important prerequisites |
| --- | --- | --- | --- |
| `ops/dev-up.sh` | Starts the cluster, builds/loads the runner image, brings up the Compose stack, and runs the outbox worker in the foreground. | The normal way to start working (`make up`). | Docker, kind, kubectl, bun. Set `SKIP_WORKER=1` to skip the worker. |
| `ops/dev-down.sh` | Stops the Compose stack. `--cluster` also deletes the cluster, `--volumes` also drops the database volume. | Teardown (`make down` / `make down-all`). | Docker. |
| `ops/smoke-test.sh` | End-to-end check: submits a test run and asserts a result reaches PostgreSQL. | After `dev-up.sh`, for one pass/fail signal. | The full stack running, worker included. |
| `ops/lib.sh` | Shared defaults and helpers, including the kind host-gateway lookup. | Sourced by the other ops scripts. | Set `WORKLOAD_CONTEXT`, `WORKLOAD_CLUSTER_NAME`, or `APP_NAMESPACE` to override defaults. |
| `ops/kind/bootstrap-workload.sh` | Creates the kind cluster. Idempotent. | Called by `dev-up.sh`; run directly via `make cluster-up`. | Docker, kind, kubectl. |
| `ops/kind/delete-workload.sh` | Deletes the kind cluster. No-op if absent. | Teardown (`make cluster-down`). | kind. |
| `ops/kind/probe-callback.sh` | Probes a host address from inside a cluster pod. | When runner callbacks are not arriving. | Cluster running; defaults to the kind network gateway. |
| `ops/k8s/setup-cluster-base.sh` | Applies the `app` and `tests` namespaces and default resource limits. | Called by `dev-up.sh`. | Cluster context must exist. |
| `ops/k6-runner/*` | k6 runner image, entrypoint, and generated k6 script used by the runner Jobs. | Built by `dev-up.sh`. | Runner callbacks require `RUNNER_SHARED_SECRET` and a reachable `RUNNER_CALLBACK_BASE_URL`. |

## Package Scripts

Root `package.json`:

Root ops scripts load `.env` through `ops/run-with-env.sh`. Backend integration scripts load `backend/.env` for hybrid mode and `backend/.env.cluster` for full-cluster mode.

| Script | Purpose | When to run | Important prerequisites |
| --- | --- | --- | --- |
| `npm run dev` | Runs workspace dev scripts through Turbo. | Local development for both apps. | Start the worker separately for dispatch flows. |
| `npm run api` | Runs the backend API in watch mode. | When you want the API from source instead of the Compose image. | Backend env vars and reachable database. |
| `npm run worker` | Runs the backend worker in watch mode. | Worker development. | Backend env vars, reachable database, and kube access for runner jobs. |
| `npm run dev:up` | Starts everything and runs the worker in the foreground. Same as `make up`. | The normal way to start working. | Docker, kind, kubectl, bun. |
| `npm run dev:down` | Stops the Compose stack. Same as `make down`. | Teardown. | Docker. |
| `npm run smoke` | End-to-end smoke test. | After `dev:up`, for one pass/fail signal. | Full stack running, worker included. |
| `npm run test:integration` | Runs the end-to-end integration suite. | Same prerequisites as the smoke test. | Full stack running, worker included. |
| `npm run build` | Builds all workspaces through Turbo. | Release or CI validation. | Workspace dependencies installed. |
| `npm run lint` | Lints all workspaces through Turbo. | Local or CI quality gate. | Workspace dependencies installed. |
| `npm run format` | Formats all workspaces through Turbo. | Before committing formatting-only fixes. | Writes files. |
| `npm run typecheck` | Typechecks all workspaces through Turbo. | Local or CI quality gate. | Workspace dependencies installed. |
| `npm run commitlint` | Checks the latest commit message. | Commit/CI validation. | Requires a previous commit to compare from `HEAD~1`. |
| `npm run prepare` | Installs Husky hooks. | Usually run by npm lifecycle. | Git checkout with Husky installed. |

Backend `backend/package.json`:

| Script | Purpose | When to run | Important prerequisites |
| --- | --- | --- | --- |
| `npm --workspace backend run dev` | Starts the API with Bun watch. | Local API development. | Required backend env vars. |
| `npm --workspace backend run worker:dev` | Starts the worker with Bun watch. | Worker development; this is what `dev-up.sh` runs. | Required backend env vars and kube access for runner jobs. |
| `npm --workspace backend run test` | Runs the backend unit tests under `src/tests`. Pins the integration gate off, so it never needs a cluster. | Backend validation. | None. |
| `npm --workspace backend run test:integration` | Runs the end-to-end integration suite against the running stack. | Full validation. | Compose stack up, worker running, cluster reachable. |
| `npm --workspace backend run build` | Compiles TypeScript to `dist`. | Release or CI validation. | Dependencies installed. |
| `npm --workspace backend run start` | Runs built API from `dist`. | Production-style local API run. | Run `build` first. |
| `npm --workspace backend run worker:start` | Runs built worker from `dist`. | Production-style local worker run. | Run `build` first. |
| `npm --workspace backend run migrate:latest` | Applies latest Knex migrations. | Before using a fresh or changed database. | Correct `DATABASE_URL`. |
| `npm --workspace backend run migrate:rollback` | Rolls back the latest Knex migration batch. | Local schema rollback. | Correct `DATABASE_URL`; use carefully. |
| `npm --workspace backend run lint` | Runs Biome checks for backend. | Backend quality gate. | Dependencies installed. |
| `npm --workspace backend run format` | Formats backend files. | Formatting fixes. | Writes files. |
| `npm --workspace backend run typecheck` | Typechecks backend without emitting files. | Backend quality gate. | Dependencies installed. |

Frontend `frontend/package.json`:

| Script | Purpose | When to run | Important prerequisites |
| --- | --- | --- | --- |
| `npm --workspace frontend run dev` | Starts React Router dev server. | Frontend development. | Configure API env/proxy for the target backend. |
| `npm --workspace frontend run build` | Builds the frontend. | Release or CI validation. | Dependencies installed. |
| `npm --workspace frontend run start` | Serves the built frontend on `0.0.0.0:3000`. | Production-style local run. | Run `build` first. |
| `npm --workspace frontend run lint` | Runs Biome checks for frontend. | Frontend quality gate. | Dependencies installed. |
| `npm --workspace frontend run format` | Formats frontend files. | Formatting fixes. | Writes files. |
| `npm --workspace frontend run typecheck` | Generates React Router types and runs TypeScript. | Frontend quality gate. | Dependencies installed. |

## Testing

Backend tests:

```bash
npm --workspace backend run test
```

Backend quality checks:

```bash
npm --workspace backend run lint
npm --workspace backend run typecheck
npm --workspace backend run build
```

Root quality checks:

```bash
npm run lint
npm run typecheck
npm run build
```

End-to-end integration. Start the stack in one terminal:

```bash
./ops/dev-up.sh
```

Then, in another:

```bash
npm run smoke              # preflight checks, then the full flow
npm run test:integration   # the flow on its own
```

The suite drives the real chain: it signs up through the API, creates a test
case, waits for the worker to dispatch a Job, waits for the k6 pod to hit the
load target and POST its signed callback, and asserts a `results` row in
PostgreSQL. The worker must be running or outbox events simply stay `PENDING`.

Troubleshooting:

- `ConnectionRefused localhost:5432`: Compose PostgreSQL is not running. Start it with `docker compose up -d postgres`.
- Runner callback cannot connect: `RUNNER_CALLBACK_BASE_URL` is not reachable from runner pods. Diagnose with `bash ops/kind/probe-callback.sh`. Note that kind's network gateway is usually `172.18.0.1`, not the `172.17.0.1` that k3d used.
- Outbox events stay `PENDING`: the worker is not running. It runs on your host, not in Compose — start it with `./ops/dev-up.sh`, or `npm run worker` on its own.
- A run stays `RUNNING`: the runner job likely completed, but its callback did not reach the API.
- `KUBERNETES_CONTEXT is required` or `not found in kubeconfig`: the worker refuses to guess a cluster. Set `KUBERNETES_CONTEXT=kind-taas-dev` in `backend/.env`, and confirm the cluster exists with `kubectl config get-contexts`.
- `ErrImagePull` on runner pods: the runner image was built but not loaded into kind. Re-run `./ops/dev-up.sh`, which rebuilds and reloads it.
- The k6 run reports connection errors against the target: runner pods reach the load target through the host gateway, not `localhost`. Confirm the target is up with `docker compose ps load-target` and that port 8080 is published.
- Self-signed Kubernetes certificate errors: use the current kubeconfig context and current backend code; the Kubernetes client path is written for the active kubeconfig/in-cluster config.

## Additional Documentation

Project documentation is under `docs/`:

- `docs/00-context/` - problem statement and context.
- `docs/01-product/` - functional and non-functional requirements.
- `docs/02-architecture/` - architecture and domain boundaries.
- `docs/03-decisions/` - Architecture Decision Records.
- `docs/04-quality/` - quality gates and traceability.
- `docs/05-operations/` - local operations and Kubernetes/k6 guides.

Useful references:

- `docs/02-architecture/backend-architecture.md`
- `docs/02-architecture/frontend-architecture.md`
- `docs/03-decisions/ADR-005-kind-over-k3d-for-local-cluster.md`
- `docs/05-operations/kubernetes-basics.md`
- `docs/05-operations/load-testing-study-guide.md`
- `backend/docs/outbox-worker-spec.md`

AI agent instructions (Claude Code and others) live in `CLAUDE.md` at the repo root, which references the project skills in `.claude/skills/`.
