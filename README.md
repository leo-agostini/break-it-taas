# Break It TaaS

Break It TaaS is a test-as-a-service application for defining load test cases, starting test runs, dispatching runner jobs to Kubernetes/K3S, and collecting execution results.

The repository is an npm workspace with two applications:

- `backend/` - Bun + Elysia API, PostgreSQL persistence, outbox worker, and Kubernetes job orchestration.
- `frontend/` - React Router frontend.

## Prerequisites

- Node.js 22+
- npm 11+
- Bun 1.2+
- Docker
- PostgreSQL 16, or Docker Compose for the local database
- kubectl, helm, and k3d for the K3S/K3D workflow

Install workspace dependencies from the repository root:

```bash
npm install
```

## Backend

The backend requires these environment variables:

```bash
export JWT_SECRET='local-dev-secret-change-me'
export JWT_REFRESH_SECRET='local-dev-refresh-secret-change-me'
export RUNNER_SHARED_SECRET='local-runner-shared-secret'
export RUNNER_CALLBACK_BASE_URL='http://localhost:3001'
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/app'
```

Optional backend variables:

- `PORT` - defaults to `3001`.
- `JWT_ACCESS_TTL` - defaults to `15m`.
- `JWT_REFRESH_TTL` - defaults to `7d`.
- `CORS_ORIGIN` - defaults to `*`.
- `COOKIE_SECURE` - defaults to `false`.
- `COOKIE_SAMESITE` - defaults to `Lax`.
- `COOKIE_DOMAIN` - unset by default.
- `K3S_QUEUE_ENDPOINT` - optional outbox target endpoint.
- `RUNNER_IMAGE` - defaults to `breakit-runner:local`.
- `K3S_NAMESPACE` - defaults to `app`.

Run the database migrations:

```bash
npm --workspace backend run migrate:latest
```

Start the API:

```bash
npm --workspace backend run dev
```

Start the outbox worker in another terminal:

```bash
npm --workspace backend run worker:dev
```

The backend listens on `http://localhost:3001` by default.

## Frontend

The frontend uses `VITE_API_URL` as the API base URL:

```bash
export VITE_API_URL='http://localhost:3001/api'
npm --workspace frontend run dev
```

The React Router dev server runs on its default development port. For a production-style local run:

```bash
npm --workspace frontend run build
npm --workspace frontend run start
```

## Run Both Apps Locally

From the repository root:

```bash
npm run dev
```

This runs workspace development scripts through Turbo. Run the backend worker separately when testing outbox dispatching:

```bash
npm --workspace backend run worker:dev
```

## Docker

The repository includes `docker-compose.yml` for PostgreSQL, backend, migration, and outbox worker containers.

Start the Docker stack:

```bash
docker compose up --build
```

Stop it:

```bash
docker compose down
```

Remove the PostgreSQL volume as well:

```bash
docker compose down -v
```

Current compose notes:

- Backend is exposed on `http://localhost:3001`.
- PostgreSQL is exposed on `localhost:5432`.
- The frontend service is present in `docker-compose.yml` but currently commented out.
- Compose values are local defaults and must not be reused as production secrets.

## K3S / K3D

The local Kubernetes workflow uses k3d to run K3S clusters in Docker. The operations guide is in `docs/05-operations/k3d-rancher-lab.md`.

Make scripts executable if needed:

```bash
chmod +x ops/k3d/bootstrap-mgmt.sh ops/k3d/bootstrap-workload.sh ops/k8s/apply-phase-3-5.sh ops/k8s/deploy-app-local.sh
```

Create the Rancher management cluster:

```bash
./ops/k3d/bootstrap-mgmt.sh
```

Open the Rancher URL printed by the script and log in with the printed credentials. Then create an imported cluster in Rancher and export the import URL:

```bash
export RANCHER_IMPORT_URL='https://rancher.<ip>.sslip.io/v3/import/<token>.yaml'
./ops/k3d/bootstrap-workload.sh
```

For a local-only workload cluster without Rancher import:

```bash
SKIP_RANCHER_IMPORT=1 ./ops/k3d/bootstrap-workload.sh
```

Apply namespaces, limits, PostgreSQL, backup, and restore-check resources:

```bash
./ops/k8s/apply-phase-3-5.sh
```

Build local images, import them into k3d, and deploy the app stack:

```bash
./ops/k8s/deploy-app-local.sh
```

Default ingress URLs:

- Backend: `http://api.127.0.0.1.sslip.io/api/health`
- Frontend: `http://app.127.0.0.1.sslip.io`

If ingress is mapped to a non-default port, set `INGRESS_HTTP_PORT` when deploying:

```bash
INGRESS_HTTP_PORT=8080 ./ops/k8s/deploy-app-local.sh
```

## What K3S Needs To Run

Required local tools:

- Docker, because k3d runs K3S nodes as containers and imports local images into the cluster.
- k3d, to create the management and workload clusters.
- kubectl, to apply manifests and inspect resources.
- helm, to install cert-manager and Rancher.
- curl, used by the bootstrap and health-check flows.

Required cluster resources and configuration:

- A workload cluster context, defaulting to `k3d-workload`.
- Namespaces from `ops/k8s/base/00-namespaces.yaml`, including `app` and `data`.
- Resource limits from `ops/k8s/base/01-limits.yaml`.
- PostgreSQL resources from `ops/k8s/data/postgres.yaml`.
- The `postgres-auth` secret in the `data` namespace. It can be generated with `ops/k8s/apply-data-secrets.sh`.
- The `app-env` secret in the `app` namespace. It can be generated with `ops/k8s/apply-app-secrets.sh`.
- Backend, frontend, worker, service, ingress, and RBAC manifests from `ops/k8s/app/`.
- A runner image available to the workload cluster. `ops/k8s/deploy-app-local.sh` builds and imports `breakit-k6-runner:local`.
- Backend permissions to create runner jobs. The RBAC manifest is `ops/k8s/app/worker-rbac.yaml`.

Important K3S environment values:

- `WORKLOAD_CONTEXT` - kubectl context, default `k3d-workload`.
- `WORKLOAD_CLUSTER_NAME` - k3d cluster name, default `workload`.
- `APP_NAMESPACE` - app namespace, default `app`.
- `DATA_NAMESPACE` - data namespace, default `data`.
- `DATABASE_URL` - app database URL, default `postgres://appuser:apppassword@postgres.data.svc.cluster.local:5432/taas` in K3S scripts.
- `RUNNER_SHARED_SECRET` - HMAC shared secret used between backend and runner callbacks.
- `RUNNER_CALLBACK_BASE_URL` - backend callback base URL used by runner jobs.
- `RUNNER_IMAGE` - runner image used in Kubernetes jobs.
- `K3S_NAMESPACE` - namespace where runner jobs are created.

Run the K3S integration test only when the workload cluster is up:

```bash
RUN_K3S_INTEGRATION=1 npm --workspace backend run test:integration:k3s
```

## Quality Commands

Run from the repository root:

```bash
npm run lint
npm run typecheck
npm run build
```

Backend tests:

```bash
npm --workspace backend run test
```

## Documentation And ADRs

Project documentation is under `docs/`:

- `docs/00-context/` - problem statement and context.
- `docs/01-product/` - functional and non-functional requirements.
- `docs/02-architecture/` - architecture and domain boundaries.
- `docs/03-decisions/` - Architecture Decision Records (ADRs).
- `docs/04-quality/` - quality gates and traceability.
- `docs/05-operations/` - local operations and K3D/Rancher guides.

Current ADRs are in `docs/03-decisions/`.
