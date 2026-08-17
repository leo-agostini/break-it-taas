# K3s and Kubernetes Basics (Project-Focused)

This guide is a practical Kubernetes primer using the exact setup in this repository.
It explains core concepts, what our YAML files do, the scripts we use, and common commands.

## 1) Core concepts

## Cluster
A **cluster** is the full Kubernetes environment (control plane + worker machines) where workloads run.

In this project:
- `k3d-mgmt`: management cluster (Rancher/cert-manager)
- `k3d-workload`: workload cluster (backend, DB, workers, k6 jobs)

## Node
A **node** is a machine in the cluster that runs pods.

In k3d, nodes are Docker containers representing K3s server/agent nodes.

## Namespace
A **namespace** is a logical partition inside a cluster.

In this project:
- `app`: API/backend/worker/load target
- `data`: PostgreSQL and backup jobs
- `tests`: reserved testing namespace

## Pod
A **pod** is the smallest deployable Kubernetes unit (one or more tightly coupled containers).

Examples here:
- `backend-*` pod: API container
- `outbox-worker-*` pod: worker container
- `testrun-*` pod: one-shot k6 runner job

## Deployment
A **deployment** manages long-running pods and rolling updates.

Examples:
- `backend` (2 replicas)
- `outbox-worker` (1 replica)
- `load-target` (1 replica)

## StatefulSet
A **statefulset** is for stateful workloads needing stable identity/storage.

Example:
- `postgres` in `data` namespace

## Service
A **service** gives stable networking to pods selected by labels.

Examples:
- `backend.app.svc.cluster.local`
- `postgres.data.svc.cluster.local`
- `load-target.app.svc.cluster.local`

## Ingress
An **ingress** maps external HTTP host/path to internal services.

Example:
- `api.127.0.0.1.sslip.io` -> `backend` service

## Job / CronJob
- **Job**: one-time batch execution
- **CronJob**: scheduled recurring jobs

Examples:
- `testrun-*` k6 runner job (one test run)
- `postgres-backup` cronjob (every 6 hours)
- `postgres-restore-check` job (validation)

## Secret
A **secret** stores sensitive config values as Kubernetes objects.

Examples:
- DB URL
- JWT secret
- runner shared secret

## RBAC
**Role-based access control** limits what service accounts can do.

Example:
- outbox worker can only create/get/list jobs in `app` namespace.

---

## 2) How this project uses K3s end-to-end

1. API receives test-case/run request.
2. Outbox worker claims pending events.
3. Worker creates a k6 **Job** in `app` namespace.
4. Job pod (`testrun-*`) runs load against `load-target` service.
5. Runner callback updates run/result in backend.
6. Normalized metrics persist to `test_run_metrics`.

Why this matters:
- API stays responsive.
- Test execution is isolated per run.
- Cluster primitives (jobs, services, RBAC, secrets) are used as in real systems.

---

## 3) What each YAML file does

## Base
- `ops/k8s/base/00-namespaces.yaml`
  - Creates `app`, `data`, `tests` namespaces.
- `ops/k8s/base/01-limits.yaml`
  - Default CPU/memory requests/limits per namespace.

## Data layer
- `ops/k8s/data/postgres.yaml`
  - `Secret` (`postgres-auth`) with DB credentials
  - `Service` (`postgres`) on port 5432
  - `StatefulSet` (`postgres`) with PVC-backed storage
- `ops/k8s/data/postgres-backup.yaml`
  - PVC for backup files
  - `CronJob` to `pg_dump` and retain last N backups
- `ops/k8s/data/postgres-restore-check.yaml`
  - `Job` that restores latest backup into validation DB and checks it

## App layer
- `ops/k8s/app/app-env-secret.yaml`
  - App runtime env vars (JWT, DB URL, runner image, callback secret/base URL)
- `ops/k8s/app/worker-rbac.yaml`
  - ServiceAccount + Role + RoleBinding for outbox worker job publishing
- `ops/k8s/app/backend-deployment.yaml`
  - Backend deployment with probes and env vars
- `ops/k8s/app/backend-service.yaml`
  - Exposes backend pods as ClusterIP service
- `ops/k8s/app/backend-ingress.yaml`
  - Host-based external route to backend service
- `ops/k8s/app/outbox-worker-deployment.yaml`
  - Worker deployment that executes `bun run src/worker.ts`
- `ops/k8s/app/load-target.yaml`
  - Synthetic target app used during load tests

---

## 4) What the shell scripts do

All k8s scripts source `ops/lib.sh`, which sets common defaults (`WORKLOAD_CONTEXT`, `APP_NAMESPACE`, `DATA_NAMESPACE`, `WORKLOAD_CLUSTER_NAME`) and provides a `kube()` shorthand for `kubectl --context "${WORKLOAD_CONTEXT}"`. Override any default by exporting the variable before running a script. All scripts should be run from the repository root.

## `ops/k3d/bootstrap-mgmt.sh`
Purpose: create management cluster and install Rancher stack.

Steps:
1. create `k3d-mgmt`
2. install cert-manager via Helm
3. install Rancher via Helm
4. wait for rollout
5. print Rancher URL/login

## `ops/k3d/bootstrap-workload.sh`
Purpose: create workload cluster and import into Rancher.

Steps:
1. create `k3d-workload` (1 server, 2 agents)
2. switch context
3. apply Rancher import manifest (`RANCHER_IMPORT_URL`)
4. wait cluster-agent rollout

## `ops/k8s/setup-data-layer.sh`
Purpose: bootstrap platform and data essentials.

Steps:
1. apply namespaces + limits
2. deploy Postgres statefulset
3. apply backup cronjob
4. run immediate backup dry-run job
5. run restore validation job

## `ops/k8s/deploy-app-local.sh`
Purpose: build, import, and deploy app stack to workload cluster.

Steps:
1. build backend image
2. build k6 runner image
3. import images into k3d cluster
4. apply app manifests
5. wait rollouts
6. verify pods/services/endpoints
7. health-check ingress endpoint

Important note:
- this script does **not** run DB migrations automatically.

---

## 5) Most common commands and what they do

## Cluster and context
```bash
kubectl config get-contexts
```
Lists all kube contexts.

```bash
kubectl config use-context k3d-workload
```
Switches active cluster context.

## Workloads and health
```bash
kubectl --context k3d-workload -n app get pods -o wide
```
Shows pod status, node, IP, restarts.

```bash
kubectl --context k3d-workload -n app rollout status deployment/backend
```
Waits until rollout is fully ready.

```bash
kubectl --context k3d-workload -n app rollout restart deployment/backend deployment/outbox-worker
```
Forces pod recreation to pick updated image.

## Debug and logs
```bash
kubectl --context k3d-workload -n app logs pod/<pod-name>
```
Reads container logs.

```bash
kubectl --context k3d-workload -n app describe pod <pod-name>
```
Shows events, probes, mounts, scheduling details.

## Resource usage
```bash
kubectl --context k3d-workload -n app top pod -l app=load-target --no-headers
```
Shows target pod CPU/memory usage.

```bash
kubectl --context k3d-workload top nodes
```
Shows node-level usage percentages.

## Jobs
```bash
kubectl --context k3d-workload -n app get jobs
```
Lists test runner jobs.

```bash
kubectl --context k3d-workload -n app get pods --sort-by=.metadata.creationTimestamp
```
Finds latest `testrun-*` pod quickly.

## Database checks
```bash
kubectl --context k3d-workload -n data exec statefulset/postgres -- psql -U postgres -d app -c "\dt"
```
Shows DB tables.

```bash
kubectl --context k3d-workload -n app exec -it <backend-pod> -- bun run migrate:latest
```
Runs backend migrations inside cluster.

---

## 6) Labels/selectors used in practice

Kubernetes wiring depends on labels:
- pods have labels like `app: backend`, `app: load-target`
- services select matching labels
- monitoring commands can filter by labels

Examples:
```bash
kubectl -n app get pods -l app=load-target
kubectl -n app top pod -l app=load-target
```

---

## 7) Common issues and quick diagnosis

## Pods not updating after code changes
Cause: image tag unchanged and pods not restarted.
Fix:
1. run `./ops/k8s/deploy-app-local.sh`
2. restart deployments (`rollout restart`)

## Migration not applied
Cause: deploy script does not run migrations.
Fix:
- run migration command inside backend pod.

## High dropped iterations in k6
Cause: arrival-rate target exceeds effective capacity (VU cap + response times + target limits).
Check:
- runner logs for timeouts and VU cap warnings
- `test_run_metrics` (`dropped_iterations`, `achieved_rps`, flags)

## Callback auth failures
Cause: shared secret mismatch or signature calculation mismatch.
Check:
- `RUNNER_SHARED_SECRET` alignment
- callback signature verification logs

---

## 8) Quick study checklist

- I can explain cluster/node/pod/deployment/service/ingress/job/cronjob.
- I can describe why StatefulSet is used for Postgres.
- I can explain how outbox worker publishes k6 jobs.
- I can run and interpret `kubectl get`, `logs`, `describe`, `top`, `rollout`.
- I can explain difference between requested and achieved throughput.
- I can explain why dropped iterations happen in arrival-rate tests.
