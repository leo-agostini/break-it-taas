#!/usr/bin/env bash
# End-to-end smoke test: submits a test run through the API, waits for the
# runner Job to finish, and asserts a result row landed in PostgreSQL.
#
# One pass/fail signal for the whole chain:
#   API (Compose) -> outbox -> worker (host) -> Job (kind) -> k6 pod
#     -> load target (Compose) -> callback -> PostgreSQL (Compose)
#
# Prerequisite: ops/dev-up.sh must be running, since the worker is what turns
# outbox events into Jobs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

API_PORT="${API_PORT:-3001}"
API_HEALTH_URL="${API_HEALTH_URL:-http://localhost:${API_PORT}/api/health}"

require_command docker
require_command kubectl
require_node_24

log "[1/4] Checking cluster context '${WORKLOAD_CONTEXT}'"
kube cluster-info >/dev/null 2>&1 ||
  die "Cannot reach '${WORKLOAD_CONTEXT}'. Run: ./ops/dev-up.sh"

log "[2/4] Checking the Compose stack"
for service in postgres backend load-target; do
  docker compose ps --status running --services 2>/dev/null | grep -qx "${service}" ||
    die "Compose service '${service}' is not running. Run: ./ops/dev-up.sh"
done

log "[3/4] Checking API health at ${API_HEALTH_URL}"
curl -sS --fail --max-time 10 "${API_HEALTH_URL}" >/dev/null ||
  die "API is not responding at ${API_HEALTH_URL}. Inspect: docker compose logs backend"
echo

log "[4/4] Running the end-to-end flow (this submits a real load test)"
cd "${SCRIPT_DIR}/.."
if npm --workspace backend run test:integration; then
  log "SMOKE TEST PASSED"
else
  die "SMOKE TEST FAILED. Check that the worker is running (ops/dev-up.sh), then inspect: kubectl --context ${WORKLOAD_CONTEXT} -n ${APP_NAMESPACE} get jobs,pods"
fi
