# Kubernetes Basics (Project-Focused)

This guide is a practical Kubernetes primer using the exact setup in this repository.
The local cluster is **kind** (upstream Kubernetes in Docker) — see
[ADR-005](../03-decisions/ADR-005-kind-over-k3d-for-local-cluster.md) for why it
replaced k3d.
It explains core concepts, what our YAML files do, the scripts we use, and common commands.

## 1) Core concepts

## Cluster
A **cluster** is the full Kubernetes environment (control plane + worker machines) where workloads run.

In this project there is a single local cluster:
- `taas-dev` (kubectl context `kind-taas-dev`): backend, DB, workers, k6 jobs

## Node
A **node** is a machine in the cluster that runs pods.

In kind, nodes are Docker containers running upstream Kubernetes via kubeadm.
The local cluster has one control-plane node and two workers — enough capacity
for several runner Jobs at once. No node carries special labels or published
ports, because nothing is served from the cluster to the host.

## Namespace
A **namespace** is a logical partition inside a cluster.

In this project:
- `app`: where runner Jobs are created
- `tests`: reserved testing namespace

There is no `data` namespace. PostgreSQL runs outside the cluster, so there is
no data layer to partition.

## Pod
A **pod** is the smallest deployable Kubernetes unit (one or more tightly coupled containers).

There is one kind of pod here:
- `testrun-*`: a one-shot k6 runner job, created by the worker

The API and worker pods that used to run here now run in Compose and on your
host respectively.

## Deployment
A **deployment** manages long-running pods and rolling updates.

This project no longer runs any. The API, worker, frontend, database, and load
target all live outside the cluster — see
[ADR-006](../03-decisions/ADR-006-compose-first-local-environment.md). The
cluster runs Jobs only, so nothing here needs rolling updates.

## StatefulSet
A **statefulset** is for stateful workloads needing stable identity/storage.

Also none. PostgreSQL was an in-cluster StatefulSet; it now runs in Docker
Compose, which keeps the cluster stateless and disposable.

## Service
A **service** gives stable networking to pods selected by labels.

None either, for the same reason: runner Jobs are the only workload, and nothing
calls *into* them. Runner pods make outbound calls — to the API's callback
endpoint and to the load target — and both of those are on the host, reached
through the kind network gateway (usually `172.18.0.1`) rather than by Service
DNS.

## Ingress
An **ingress** maps external HTTP host/path to internal services.

Not used. An ingress controller existed while the API ran in the cluster; with
the API in Compose there is nothing to route to, so ingress-nginx and the host
port mappings were removed.


## Job / CronJob
- **Job**: one-time batch execution
- **CronJob**: scheduled recurring jobs

Examples:
- `testrun-*` k6 runner job (one test run)

Database backup and restore-check CronJobs used to live here; they moved out
with PostgreSQL.

## Secret
A **secret** stores sensitive config values as Kubernetes objects.

Examples:
- DB URL
- `APP_KEY` (criptografia do cookie de sessão)
- runner shared secret

## RBAC
**Role-based access control** limits what service accounts can do.

Example:
- outbox worker can only create/get/list jobs in `app` namespace.

---

## 2) How this project uses Kubernetes end-to-end

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
  - Creates `app` and `tests` namespaces. Runner Jobs land in `app`.
- `ops/k8s/base/01-limits.yaml`
  - Default CPU/memory requests/limits per namespace.

## Cluster topology
- `ops/kind/kind-config.yaml`
  - One control-plane node and two workers. No ingress wiring and no published
    ports, because nothing is served from the cluster to the host.

That is the entire set. Application manifests — backend Deployment/Service/
Ingress, worker Deployment, worker RBAC, app ConfigMap and Secret — were deleted
when the application moved to Docker Compose. Deployment manifests for a real
environment belong to the separate infrastructure component.

## Where everything else runs

| Piece | Runs in |
| --- | --- |
| API, frontend, PostgreSQL, load target | Docker Compose |
| Outbox worker | your host (needs a kubeconfig to dispatch Jobs) |
| k6 runner Jobs | this cluster, namespace `app` |

---


## 4) What the shell scripts do

All ops scripts source `ops/lib.sh`, which sets common defaults
(`WORKLOAD_CONTEXT`, `WORKLOAD_CLUSTER_NAME`, `APP_NAMESPACE`), resolves the
kind host gateway, and provides a `kube()` shorthand for
`kubectl --context "${WORKLOAD_CONTEXT}"`. Override any default by exporting the
variable first. Run all scripts from the repository root.

## `ops/dev-up.sh`
Purpose: bring up the whole local environment and run the worker.

Steps:
1. create the kind cluster if absent, and apply namespaces and limits
2. build the k6 runner image and load it into the cluster
3. `docker compose up -d --build`
4. wait for the API to report healthy
5. resolve and print the host gateway addresses runner pods will use
6. run the outbox worker in the foreground

Set `SKIP_WORKER=1` to stop after step 5.

## `ops/dev-down.sh`
Purpose: stop the Compose stack. `--cluster` also deletes the cluster;
`--volumes` also drops the PostgreSQL volume.

## `ops/kind/bootstrap-workload.sh`
Purpose: create the cluster. Idempotent — re-running it reuses an existing one.
Verifies that `WORKLOAD_CONTEXT` matches the context kind actually created, so a
mismatch fails loudly instead of acting on the wrong cluster.

## `ops/kind/delete-workload.sh`
Purpose: delete the cluster. No-op if it does not exist.

## `ops/kind/probe-callback.sh`
Purpose: verify a host address is reachable from inside a cluster pod — what
runner pods need to POST results back to the API.

## `ops/k8s/setup-cluster-base.sh`
Purpose: apply the `app` and `tests` namespaces and default resource limits.

## `ops/smoke-test.sh`
Purpose: one pass/fail signal for the whole chain. Checks the cluster, the
Compose services, and API health, then runs the end-to-end integration suite.

---


## 5) Most common commands and what they do

## Cluster and context
```bash
kubectl config get-contexts
```
Lists all kube contexts.

```bash
kubectl config use-context kind-taas-dev
```
Switches active cluster context.

## Workloads and health
```bash
kubectl --context kind-taas-dev -n app get pods -o wide
```
Shows runner pod status, node, IP, restarts.

```bash
docker compose ps
```
The API, frontend, database, and load target are Compose services, so their
health is checked there rather than with kubectl.

## Debug and logs
```bash
kubectl --context kind-taas-dev -n app logs pod/<pod-name>
```
Reads container logs.

```bash
kubectl --context kind-taas-dev -n app describe pod <pod-name>
```
Shows events, probes, mounts, scheduling details.

## Resource usage
```bash
docker stats --no-stream breakit-load-target
```
Shows load target CPU/memory. It runs in Compose, so `kubectl top` will not see
it; `docker stats` reports CPU as a percentage of one core, meaning 12.5% is the
same as 125 millicores.

```bash
kubectl --context kind-taas-dev top nodes
```
Shows node-level usage percentages.

## Jobs
```bash
kubectl --context kind-taas-dev -n app get jobs
```
Lists test runner jobs.

```bash
kubectl --context kind-taas-dev -n app get pods --sort-by=.metadata.creationTimestamp
```
Finds latest `testrun-*` pod quickly.

## Database checks
PostgreSQL runs in Docker Compose, not in the cluster, so query it directly:

```bash
docker compose exec postgres psql -U postgres -d app -c "\dt"
```
Shows DB tables.

```bash
npm --workspace backend run migrate:latest
```
Runs backend migrations from the host against `DATABASE_URL`. The Compose stack
also runs them once on startup via the `migrate` service.

---

## 6) Labels/selectors used in practice

Kubernetes wiring depends on labels:
- runner pods carry `app.kubernetes.io/name: test-runner` and
  `breakit/test-run-id: <run id>`
- monitoring commands can filter by either

Examples:
```bash
kubectl -n app get pods -l app.kubernetes.io/name=test-runner
kubectl -n app get pods -l breakit/test-run-id=<run-id>
```

That second label is how the integration suite finds the pod for a specific
run.

---

## 7) Common issues and quick diagnosis

## Runner pods use a stale image
Cause: the runner image was rebuilt on the host but not reloaded into the
cluster; kind nodes keep their own containerd store.
Fix:
- re-run `./ops/dev-up.sh`, which rebuilds and reloads it

API or frontend changes need no cluster step at all — they are Compose
services (`docker compose up -d --build backend`).

## Migration not applied
Cause: migrations are not run automatically on every start.
Fix:
- `npm --workspace backend run migrate:latest` from the host

## Outbox events stay PENDING
Cause: the worker is not running. It runs on your host, not in Compose.
Fix:
- `./ops/dev-up.sh`, or `npm run worker` on its own

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

- I can explain cluster/node/pod/namespace/job.
- I can explain why only runner Jobs run in the cluster, and what runs outside it.
- I can explain how the outbox worker publishes k6 jobs, and why it needs a kubeconfig.
- I can run and interpret `kubectl get`, `logs`, `describe`, and `docker compose ps` / `docker stats`.
- I can explain difference between requested and achieved throughput.
- I can explain why dropped iterations happen in arrival-rate tests.
