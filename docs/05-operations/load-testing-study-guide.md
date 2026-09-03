# Load Testing Study Guide (Break-It TAAS)

## 1. Why a Local Kubernetes Cluster

Why we needed one:
- We needed a realistic container orchestration environment.
- We wanted to validate queue -> job -> callback behavior in-cluster.
- It is affordable and practical for a final paper and cheap VPS scenarios.

The project originally used **k3d** (k3s in Docker), a lightweight distribution
that trades fidelity for speed. It now uses **kind**, which runs upstream
Kubernetes via kubeadm — the same components a managed cluster runs — so that a
Job which schedules locally is evidence it will schedule in production. See
[ADR-005](../03-decisions/ADR-005-kind-over-k3d-for-local-cluster.md).

In this project, we use:
- **kind** cluster `taas-dev` (kubectl context `kind-taas-dev`)
- A single **workload cluster** where backend, worker, runner jobs, and target service run
- Kubernetes primitives: Deployments, Services, Ingress, Jobs, Secrets, RBAC

---

## 2. Architecture We Built

High-level flow:
1. User creates a test case through API.
2. API creates a test run and writes an outbox event.
3. Outbox worker (on your host) publishes a Kubernetes Job for the k6 runner.
4. Runner pod executes the load test against the target API, reaching it through
   the kind network's host gateway since the target runs in Compose.
5. Runner sends signed callback to internal backend endpoint.
6. Backend persists run status and raw result.
7. Backend projects normalized metrics into a CQRS read model (`test_run_metrics`).

Why this architecture:
- Decouples API response time from test execution time.
- Supports retries and resilience via outbox pattern.
- Matches real systems where execution is asynchronous and distributed.

---

## 3. Core Kubernetes Objects Used

The cluster runs one workload type. Everything else moved to Docker Compose and
the host — see
[ADR-006](../03-decisions/ADR-006-compose-first-local-environment.md).

### Job
Used for one-shot k6 execution:
- `testrun-*` runner pods, in namespace `app`

Why:
- Each test run is an isolated execution unit with a clear lifecycle: it runs
  once, reports, and its pod is reclaimed (`ttlSecondsAfterFinished`).
- `backoffLimit: 0` and `activeDeadlineSeconds` mean a run fails loudly and on
  time rather than silently retrying.

### Namespace and LimitRange
`app` holds runner Jobs; `tests` is reserved. The LimitRange supplies default
requests and limits so a Job without explicit resources cannot starve the node.

### What is deliberately not used

| Object | Why not |
| --- | --- |
| Deployment | No long-running workload in the cluster. The API, worker, and load target run outside it. |
| Service | Nothing calls into the cluster. Runner pods only make outbound calls. |
| Ingress | Nothing to route to, so no controller is installed. |
| Secret | Runner config is passed on the Job's env, signed with HMAC. |
| RBAC | The worker runs on your host with your kubeconfig, not as an in-cluster ServiceAccount. |

An earlier revision used all of these. If you need to talk about them, that
history is the interesting part: they were removed because the workload they
supported left the cluster, not because they stopped being good practice.

---

## 4. Common Commands (and Why)

### Cluster / Pods
```bash
kubectl --context kind-taas-dev -n app get pods -o wide
```
Why: check pod health, node placement, IPs.

```bash
docker compose ps
```
Why: the API, worker target, database, and load target are Compose services —
confirm they are healthy before testing.

### Logs / Debug
```bash
kubectl --context kind-taas-dev -n app logs pod/<runner-pod-name>
```
Why: inspect k6 behavior, timeout warnings, VU limits.

```bash
kubectl --context kind-taas-dev -n app get pods --sort-by=.metadata.creationTimestamp
```
Why: quickly find latest testrun pod.

### Resource Monitoring
```bash
docker stats --no-stream breakit-load-target
```
Why: observe target CPU/memory pressure during the test. The load target runs in
Compose, so `kubectl top` will not see it. `docker stats` reports CPU as a
percentage of one core: 12.5% is 125 millicores.

```bash
kubectl --context kind-taas-dev top nodes
```
Why: ensure node-level resources are not globally exhausted.

### Database Verification
```bash
docker compose exec postgres psql -U postgres -d app -c "select * from test_run_metrics order by updated_at desc limit 1;"
```
Why: verify normalized CQRS projection persisted correctly.

### Environment Script
```bash
./ops/dev-up.sh
```
Why: one reproducible path from a clean checkout to a running environment —
cluster, runner image, Compose stack, and the outbox worker.

---

## 5. k6 Concepts We Applied

### Arrival-rate executors
- `constant-arrival-rate`
- `ramping-arrival-rate`

Why:
- Better model for throughput intent (RPS-like goals) than VU+sleep loops.

### VU envelope (`preAllocatedVUs` and `maxVUs`)
Why:
- Prevents unconstrained memory growth and OOM.
- Controls load-generator safety on cheap infrastructure.

### Dropped iterations
Meaning:
- Scheduled iterations that could not be started in time (no free VUs / backpressure).

Why important:
- Shows gap between requested and achieved throughput.

### Request timeout
Why:
- Prevents VUs from hanging too long under saturation.
- But aggressive timeout can increase failed requests.

---

## 6. Key Lessons from Our Runs

1. **Requested rate != achieved rate**
- Example: requesting 3000/s can yield about 1000/s achieved when system saturates.

2. **High dropped iterations are expected under pressure**
- Especially with VU cap + long response times.

3. **Target bottleneck and generator bottleneck both matter**
- We improved target limits 5x (20m -> 100m CPU), throughput increased, but drops still existed due to overall limits.

4. **Lifecycle success is not performance success**
- Run can be `SUCCEEDED` while quality metrics show degradation.

5. **Normalization is essential**
- Raw k6 JSON is detailed but hard to consume.
- CQRS read model gives user-centric metrics.

---

## 7. CQRS Metrics We Normalized

Stored in `test_run_metrics`:
- requested: rate, time unit, duration
- achieved: rps, total requests, dropped iterations
- quality: failure rate, success rate, p95/p99/median
- flags: `generator_limited`, `timeouts_detected`

Why:
- Faster querying and clearer UX than parsing large artifact JSON each request.

---

## 8. Common Troubleshooting Patterns

### "Run stuck in RUNNING"
Check:
- runner pod status (`OOMKilled`, `Completed`, `Error`)
- callback route/logs
- HMAC signature mismatch events

### "Low achieved RPS"
Check:
- dropped iterations
- VU cap reached
- request timeouts
- target CPU saturation and memory pressure

### "Missing metric fields (e.g., p99)"
Fix:
- set `summaryTrendStats` explicitly in k6 options.

---

## 9. Practical Defense Talking Points

- Why kind instead of k3d:
  - upstream Kubernetes, so local scheduling behavior predicts production.
- Why Job-per-run:
  - isolation, traceability, lifecycle clarity.
- Why HMAC callback:
  - authenticity/integrity for internal completion updates.
- Why CQRS projection:
  - user-centric read performance and stable reporting.
- Why "best-effort + transparent metrics":
  - realistic for constrained VPS environments.

---

## 10. Suggested Next Improvements

- Add backfill job for old raw results into `test_run_metrics`.
- Add `strict_delivery` policy option for users.
- Add endpoint/UI comparisons for requested vs achieved with quality badges.
- Add nightly integration run in CI for regression detection.
