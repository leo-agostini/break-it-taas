# K3s Load Testing Study Guide (Break-It TAAS)

## 1. What is K3s (Basics)

K3s is a lightweight Kubernetes distribution designed for edge, local labs, and low-resource environments.
It keeps Kubernetes core behavior while reducing operational complexity.

Why we used it:
- We needed a realistic container orchestration environment.
- We wanted to validate queue -> job -> callback behavior in-cluster.
- It is affordable and practical for a final paper and cheap VPS scenarios.

In this project, we used:
- **k3d** (Docker-based wrapper to run K3s clusters locally)
- A **workload cluster** where backend, worker, runner jobs, and target service run
- Kubernetes primitives: Deployments, Services, Ingress, Jobs, Secrets, RBAC

---

## 2. Architecture We Built

High-level flow:
1. User creates a test case through API.
2. API creates a test run and writes an outbox event.
3. Outbox worker publishes a Kubernetes Job for k6 runner.
4. Runner executes load test against target service.
5. Runner sends signed callback to internal backend endpoint.
6. Backend persists run status and raw result.
7. Backend projects normalized metrics into a CQRS read model (`test_run_metrics`).

Why this architecture:
- Decouples API response time from test execution time.
- Supports retries and resilience via outbox pattern.
- Matches real systems where execution is asynchronous and distributed.

---

## 3. Core Kubernetes Objects Used

### Deployment
Used for long-running app components:
- `backend`
- `outbox-worker`
- `load-target`

Why:
- Replica management, rolling updates, self-healing.

### Service
Used for stable in-cluster networking:
- `backend` service
- `load-target` service

Why:
- Pod IPs are ephemeral; Service gives stable DNS endpoint.

### Ingress
Used to expose backend API externally for local/manual/integration access.

Why:
- Realistic HTTP entry point (`api.127.0.0.1.sslip.io`).

### Job
Used for one-shot k6 execution:
- `testrun-*` runner pods

Why:
- Each test run is isolated execution unit with clear lifecycle.

### Secret
Used for runtime config:
- DB connection
- runner shared secret
- callback base URL
- image references

Why:
- Better than hardcoding sensitive runtime values.

### RBAC
Worker permissions to create/read jobs and pods.

Why:
- Principle of least privilege for in-cluster automation.

---

## 4. Common Commands (and Why)

### Cluster / Pods
```bash
kubectl --context k3d-workload -n app get pods -o wide
```
Why: check pod health, node placement, IPs.

```bash
kubectl --context k3d-workload -n app rollout status deployment/backend
```
Why: confirm deployments are fully rolled out before testing.

```bash
kubectl --context k3d-workload -n app rollout restart deployment/backend deployment/outbox-worker
```
Why: force new pods to pick latest imported images.

### Logs / Debug
```bash
kubectl --context k3d-workload -n app logs pod/<runner-pod-name>
```
Why: inspect k6 behavior, timeout warnings, VU limits.

```bash
kubectl --context k3d-workload -n app get pods --sort-by=.metadata.creationTimestamp
```
Why: quickly find latest testrun pod.

### Resource Monitoring
```bash
kubectl --context k3d-workload -n app top pod -l app=load-target --no-headers
```
Why: observe target CPU/memory pressure during test.

```bash
kubectl --context k3d-workload top nodes
```
Why: ensure node-level resources are not globally exhausted.

### Database Verification
```bash
kubectl --context k3d-workload -n data exec statefulset/postgres -- psql -U postgres -d app -c "select * from test_run_metrics order by updated_at desc limit 1;"
```
Why: verify normalized CQRS projection persisted correctly.

### Deployment Script
```bash
./ops/k8s/deploy-app-local.sh
```
Why: reproducible build/import/apply/rollout/health-check flow.

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

- Why K3s instead of full K8s:
  - lower overhead, same orchestration concepts.
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
