# Break It TaaS

## About The Project

Break It TaaS is a test-as-a-service application for defining load test cases, dispatching Kubernetes runner jobs, hitting a target API, and collecting signed runner callbacks/results.

The project supports two main development paths:

- Hybrid mode: run the API and outbox worker locally while using k3d for PostgreSQL, runner jobs, and the load target.
- Full cluster mode: run the backend, worker, PostgreSQL, runner jobs, load target, and frontend inside k3d.

The repository is an npm workspace with `backend/` and `frontend/` applications plus `ops/` scripts for local Kubernetes workflows.

## Tech Stack

Frontend:

- React 19
- React Router 7
- Vite
- Tailwind CSS
- Radix UI
- SWR
- Recoil
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
- PostgreSQL 16, Docker Compose, or k3d PostgreSQL
- kubectl
- helm
- k3d
- curl

## Install Dependencies

Run from the repository root:

```bash
npm install
```

If shell scripts are not executable in your checkout, make them executable once:

```bash
chmod +x ops/k3d/bootstrap-mgmt.sh ops/k3d/bootstrap-workload.sh \
  ops/k8s/setup-data-layer.sh ops/k8s/deploy-app-local.sh \
  ops/k8s/apply-app-secrets.sh ops/k8s/apply-data-secrets.sh
```

## Run Backend Locally

Use this mode when the API and worker run on your host. The database can be a local PostgreSQL instance, Docker Compose PostgreSQL, or a k3d PostgreSQL port-forward.

Required backend environment:

```bash
export JWT_SECRET='local-dev-secret-change-me'
export JWT_REFRESH_SECRET='local-dev-refresh-secret-change-me'
export RUNNER_SHARED_SECRET='local-runner-shared-secret'
export RUNNER_CALLBACK_BASE_URL='http://localhost:3001'
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/app'
```

Optional values:

- `PORT` defaults to `3001`.
- `KUBERNETES_CONTEXT` defaults to `k3d-workload`.
- `JWT_ACCESS_TTL` defaults to `15m`.
- `JWT_REFRESH_TTL` defaults to `7d`.
- `CORS_ORIGIN` defaults to `*`.
- `COOKIE_SECURE` defaults to `false`.
- `COOKIE_SAMESITE` defaults to `Lax`.
- `COOKIE_DOMAIN` is unset by default.
- `K3S_QUEUE_ENDPOINT` is optional.
- `RUNNER_IMAGE` defaults to `breakit-k6-runner:local`.
- `K3S_NAMESPACE` defaults to `app`.

Run migrations:

```bash
npm --workspace backend run migrate:latest
```

Start the API:

```bash
npm --workspace backend run dev
```

Start the local outbox worker in another terminal when testing job dispatch:

```bash
npm run run:worker
```

The API listens on `http://localhost:3001` by default.

## Run Backend With K3D Hybrid Mode

Hybrid mode uses a local API and local worker, but keeps PostgreSQL, runner jobs, and the load target in k3d. Runner pods run inside Docker, so they cannot call back to `localhost`; `backend/.env` must set `RUNNER_CALLBACK_BASE_URL` to a host address reachable from k3d pods.

The root K3D scripts read root `.env`. The API, worker, migrations, and hybrid test read `backend/.env`.

1. Start K3D dev mode from the repository root:

```bash
npm run start:k3d:dev
```

This starts or creates the workload cluster, applies the data layer, deploys the app stack, scales the in-cluster `outbox-worker` to `0`, and opens the PostgreSQL port-forward on `localhost:5432`.

Keep this terminal open because the port-forward stays attached.

2. Run migrations in another terminal:

```bash
npm --workspace backend run migrate:latest
```

`backend/.env` should point `DATABASE_URL` at the forwarded k3d database:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/app
```

3. Run the local API in another terminal:

```bash
npm run run:api
```

The API listens on `http://localhost:3001` by default.

4. Verify the runner callback host from inside k3d.

`backend/.env` should set a callback URL reachable from runner pods, for example:

```env
RUNNER_CALLBACK_BASE_URL=http://172.17.0.1:3001
```

Probe it from the cluster:

```bash
kubectl --context k3d-workload -n app run callback-probe --rm -i \
  --restart=Never --image=curlimages/curl:8.10.1 -- \
  curl -sS http://172.17.0.1:3001/api/health
```

If the probe fails, replace `172.17.0.1` in `backend/.env` with a host IP reachable from k3d pods.

5. Run the local worker in another terminal:

```bash
npm run run:worker
```

6. Run the hybrid integration flow when K3D dev mode, the local API, and the local worker are all running:

```bash
npm run test:hybrid
```

Expected running terminals:

- `npm run start:k3d:dev`
- `npm run run:api`
- `npm run run:worker`
- `npm run test:hybrid` when you want to execute the integration flow.

## Run Full Cluster Mode

Full cluster mode runs the backend, outbox worker, PostgreSQL, runner jobs, load target, and frontend in k3d.

Start the full cluster mode stack:

```bash
npm run start:k3d:test
```

This starts or creates the workload cluster, applies the data layer, builds/imports local images, and deploys the backend, worker, PostgreSQL, runner assets, load target, and frontend.

For a Rancher-managed lab, use the underlying ops scripts directly: bootstrap management first, create an imported cluster in Rancher, then bootstrap the workload cluster:

```bash
bash ops/run-with-env.sh bash ops/k3d/bootstrap-mgmt.sh
export RANCHER_IMPORT_URL='https://rancher.<ip>.sslip.io/v3/import/<token>.yaml'
bash ops/run-with-env.sh bash ops/k3d/bootstrap-workload.sh
```

If this is a new database or the schema has changed, port-forward PostgreSQL before deploying or testing:

```bash
npm run db:forward
```

In another terminal, run migrations against the forwarded database:

```bash
DATABASE_URL='postgres://postgres:postgres@localhost:5432/app' npm --workspace backend run migrate:latest
```

Run the full-cluster integration flow:

```bash
npm run test:cluster
```

Default ingress URLs:

- API health: `http://api.127.0.0.1.sslip.io/api/health`
- Frontend: `http://app.127.0.0.1.sslip.io`

If ingress is mapped to a non-default host port, set `INGRESS_HTTP_PORT` when deploying:

```bash
INGRESS_HTTP_PORT=8080 npm run start:k3d:test
```

## Run The Frontend

For local frontend development against a local backend:

```bash
export VITE_API_URL='/api'
export VITE_API_PROXY_TARGET='http://localhost:3001'
npm --workspace frontend run dev
```

For local frontend development against the full k3d app ingress:

```bash
export VITE_API_URL='/api'
export VITE_API_PROXY_TARGET='http://app.127.0.0.1.sslip.io'
npm --workspace frontend run dev
```

For a production-style local frontend run:

```bash
npm --workspace frontend run build
npm --workspace frontend run start
```

In full cluster mode, the frontend is deployed by `npm run start:k3d:test` and served from `http://app.127.0.0.1.sslip.io`. The cluster nginx service proxies `/api/` to the backend service.

## Ops Scripts

| Script | Purpose | When to run | Important prerequisites |
| --- | --- | --- | --- |
| `ops/lib.sh` | Shared defaults and helpers for workload ops scripts. | Sourced by other ops scripts. | Set `WORKLOAD_CONTEXT`, `WORKLOAD_CLUSTER_NAME`, `APP_NAMESPACE`, or `DATA_NAMESPACE` to override defaults. |
| `ops/k3d/bootstrap-mgmt.sh` | Creates a k3d management cluster and installs cert-manager and Rancher. | When using the Rancher-managed lab. | Docker, k3d, kubectl, helm, ports `80`/`443` available unless overridden. |
| `ops/k3d/bootstrap-workload.sh` | Creates the k3d workload cluster and optionally imports it into Rancher. | Before applying data/app manifests. | Set `SKIP_RANCHER_IMPORT=1` for local-only mode, or set `RANCHER_IMPORT_URL` for Rancher import. |
| `ops/k8s/apply-data-secrets.sh` | Creates/updates the `postgres-auth` secret. | Before deploying PostgreSQL. | Defaults to `postgres/postgres/app`; override `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` if needed. |
| `ops/k8s/apply-app-secrets.sh` | Creates/updates the `app-env` secret. | Before deploying backend and worker. | Override JWT, database, runner, and cookie values when defaults are not appropriate. |
| `ops/k8s/setup-data-layer.sh` | Applies namespaces, limits, PostgreSQL, backup, and restore-check resources. | During cluster setup or data-layer refresh. | Workload cluster context must exist; creates backup/restore validation jobs. |
| `ops/k8s/deploy-app-local.sh` | Builds local backend, k6 runner, and frontend images; imports them into k3d; deploys app manifests. | After the workload cluster and data layer are ready. | Docker, k3d, kubectl; expects the workload cluster name from `WORKLOAD_CLUSTER_NAME` or `workload`. |
| `ops/k8s/forward-postgres.sh` | Port-forwards k3d PostgreSQL to the host. | Hybrid mode or host-run migrations against k3d Postgres. | Workload cluster and data layer ready; `POSTGRES_PORT_FORWARD` must be free. |
| `ops/k6-runner/*` | k6 runner image, entrypoint, and generated k6 script used by Kubernetes runner jobs. | Built by `ops/k8s/deploy-app-local.sh`. | Runner callbacks require `RUNNER_SHARED_SECRET` and a reachable `RUNNER_CALLBACK_BASE_URL`. |
| `ops/runner/*` | Legacy/alternate simulated runner assets. | Only for older local experiments if still needed. | Prefer `ops/k6-runner/*` for current k6 runner jobs. |

## Package Scripts

Root `package.json`:

Root K3D scripts load `.env` through `ops/run-with-env.sh`. Backend integration scripts load `backend/.env` for hybrid mode and `backend/.env.cluster` for full-cluster mode.

| Script | Purpose | When to run | Important prerequisites |
| --- | --- | --- | --- |
| `npm run dev` | Runs workspace dev scripts through Turbo. | Local development for both apps. | Start the worker separately for dispatch flows. |
| `npm run run:api` | Runs the backend API in watch mode. | Local or hybrid API development. | Backend env vars and reachable database. |
| `npm run run:worker` | Runs the backend worker in watch mode. | Local or hybrid worker development. | Backend env vars, reachable database, and kube access for runner jobs. |
| `npm run db:forward` | Port-forwards k3d PostgreSQL to `localhost:${POSTGRES_PORT_FORWARD}`. | Hybrid mode or host-run migrations against k3d Postgres. | Workload cluster and data layer ready; command stays attached. |
| `npm run start:k3d:dev` | Starts workload resources, deploys the app stack, scales in-cluster worker from `.env`, and opens the Postgres port-forward from `.env`. | Hybrid mode with local API and local worker. | `POSTGRES_PORT_FORWARD` must be free; command stays attached to the port-forward. |
| `npm run start:k3d:test` | Starts workload resources and deploys the app stack with the in-cluster worker enabled. | Full cluster integration mode. | Docker, k3d, kubectl. |
| `npm run test:cluster` | Runs full-cluster integration tests. | After `start:k3d:test`. | API ingress and k3d database available. |
| `npm run test:hybrid` | Runs hybrid integration tests. | With local API/worker and K3D dev port-forward running. | Port-forward, local API, local worker. |
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
| `npm --workspace backend run worker:dev` | Starts the worker with Bun watch. | Local/hybrid dispatch development. | Required backend env vars and kube access for runner jobs. |
| `npm --workspace backend run test` | Runs backend unit and integration-style Bun tests under `src/tests`. | Backend validation. | No k3d required unless explicitly enabled by env. |
| `npm --workspace backend run test:cluster` | Runs k3s integration with `backend/.env.cluster`. | Full cluster validation. | Full app stack and database ready. |
| `npm --workspace backend run test:hybrid` | Runs k3s integration with `backend/.env`. | Hybrid validation. | Local API, local worker, Postgres port-forward. |
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

k3d full-cluster integration:

```bash
npm run test:cluster
```

Hybrid integration requires:

- k3d workload cluster, data layer, app manifests, runner image, and load target.
- In-cluster `outbox-worker` scaled to `0`.
- `svc/postgres` port-forwarded to `localhost:5432`.
- Local API running on `http://localhost:3001`.
- Local worker running with `RUNNER_CALLBACK_BASE_URL=http://<reachable-host-ip>:3001`.

Then run:

```bash
npm run test:hybrid
```

Troubleshooting:

- `ConnectionRefused localhost:5432`: the PostgreSQL port-forward is missing or not running.
- Runner callback cannot connect: `RUNNER_CALLBACK_BASE_URL` is not reachable from k3d runner pods.
- Outbox events stay `PENDING`: the local worker is not running, or the in-cluster worker was not scaled correctly for hybrid mode.
- A run stays `RUNNING`: the runner job likely completed, but its callback did not reach the API.
- Self-signed Kubernetes certificate errors: use the current kubeconfig context and current backend code; the Kubernetes client path is written for the active kubeconfig/in-cluster config.

## Additional Documentation

Project documentation is under `docs/`:

- `docs/00-context/` - problem statement and context.
- `docs/01-product/` - functional and non-functional requirements.
- `docs/02-architecture/` - architecture and domain boundaries.
- `docs/03-decisions/` - Architecture Decision Records.
- `docs/04-quality/` - quality gates and traceability.
- `docs/05-operations/` - local operations and k3d/Rancher guides.

Useful references:

- `docs/05-operations/k3d-rancher-lab.md`
- `docs/k3s-kubernetes-basics.md`
- `docs/k3s-load-testing-study-guide.md`
- `backend/docs/outbox-worker-spec.md`
