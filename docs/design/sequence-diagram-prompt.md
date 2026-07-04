Create a clean UML-style sequence diagram (vertical lifelines with
activation bars, labeled message arrows, light background, monospace or
clean sans-serif labels, high resolution) titled
"Break It TaaS — Test Run Execution Sequence".

PARTICIPANTS (lifelines, left to right):
1. "User (Browser)"
2. "Traefik Ingress"
3. "Frontend (React SPA + nginx)"
4. "Backend API (Bun/Elysia)"
5. "PostgreSQL (test_runs + outbox_events)"
6. "Outbox Worker"
7. "Kubernetes API"
8. "k6 Runner Job (Pod)"
9. "Target API (SUT)"

MESSAGES (top to bottom, in order):

1. User -> Traefik: "POST /api/test-runs (app.127.0.0.1.sslip.io)"
2. Traefik -> Frontend nginx: route, proxy "/api/"
3. Frontend nginx -> Backend API: forward request
4. Backend API -> Backend API: validate + create TestRun (status QUEUED)
5. Backend API -> PostgreSQL: BEGIN TX — insert TestRun + insert
   OutboxEvent (TEST_RUN_REQUESTED, status PENDING) — COMMIT
   [draw as a "Transactional Outbox" combined fragment]
6. Backend API --> User: 202 Accepted (testRunId)

   ... (async boundary — dashed separator labeled "asynchronous") ...

7. Outbox Worker -> PostgreSQL: poll every ~5s
8. PostgreSQL --> Outbox Worker: claim batch (PENDING -> PROCESSING, atomic)
9. Outbox Worker -> Kubernetes API: create k6 Job (HMAC-signed config,
   via ServiceAccount RBAC)
10. Kubernetes API --> Outbox Worker: Job created (runtimeRef = job uid)
11. Outbox Worker -> PostgreSQL: TestRun.start() (RUNNING) +
    mark OutboxEvent PUBLISHED
12. Kubernetes API -> k6 Runner Job: schedule & start Pod

   loop fragment "load test":
13. k6 Runner Job -> Target API: HTTP load traffic (k6 scenario)
14. Target API --> k6 Runner Job: responses (latency / status metrics)

15. k6 Runner Job -> Backend API: POST /api/internal/test-runs/callback
    (result summary + artifacts, signed HMAC-SHA256)
16. Backend API -> Backend API: verify HMAC, validate payload
17. Backend API -> PostgreSQL: BEGIN TX — update TestRun
    (SUCCEEDED/FAILED/TIMEOUT) + save Result + upsert metrics — COMMIT
18. Backend API --> k6 Runner Job: 200 OK
19. k6 Runner Job -> Kubernetes API: Pod completes (TTL 600s -> cleanup)

   ... later ...
20. User -> Backend API: GET /api/test-runs/{id}/report
21. Backend API --> User: status + result summary + metrics

Use alt/loop fragments where noted, a clear dashed "asynchronous" divider
after message 6, and an opt fragment around message 8 for "skip if already
claimed". Keep it readable and well-spaced.
