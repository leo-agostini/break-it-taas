#!/usr/bin/env bash
# Brings up the whole local environment with one command, then runs the outbox
# worker in the foreground.
#
#   Docker Compose : API, frontend, PostgreSQL, load target (the API under test)
#   kind cluster   : k6 runner Jobs, nothing else
#   your host      : the outbox worker
#
# The worker runs here rather than in Compose because it dispatches Kubernetes
# Jobs and needs your kubeconfig. Ctrl-C stops the worker; the Compose stack and
# the cluster keep running. Use ops/dev-down.sh to tear everything down.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

RUNNER_IMAGE="${RUNNER_IMAGE:-breakit-k6-runner:local}"
API_PORT="${API_PORT:-3001}"
LOAD_TARGET_PORT="${LOAD_TARGET_PORT:-8080}"
SKIP_WORKER="${SKIP_WORKER:-0}"

require_command docker
require_command kind
require_command kubectl
require_node_24

log "[1/6] Ensuring kind cluster '${WORKLOAD_CLUSTER_NAME}'"
bash "${SCRIPT_DIR}/kind/bootstrap-workload.sh"
bash "${SCRIPT_DIR}/k8s/setup-cluster-base.sh"

log "[2/6] Building and loading the k6 runner image"
docker build -t "${RUNNER_IMAGE}" "${SCRIPT_DIR}/k6-runner"
kind load docker-image "${RUNNER_IMAGE}" --name "${WORKLOAD_CLUSTER_NAME}"

log "[3/6] Starting the Compose stack"
docker compose up -d --build

# Runner pods live in the cluster and cannot reach localhost. Everything they
# call — the callback endpoint on the API, and the load target — is published on
# the host, so both go through the kind network gateway.
gateway="$(host_gateway)"
[[ -n "${gateway}" ]] ||
  die "Could not resolve the kind network gateway. Is the cluster running?"

CALLBACK_BASE_URL="${RUNNER_CALLBACK_BASE_URL:-http://${gateway}:${API_PORT}}"
TARGET_BASE_URL="${INTEGRATION_TARGET_BASE_URL:-http://${gateway}:${LOAD_TARGET_PORT}}"

log "[4/6] Waiting for the API on http://localhost:${API_PORT}"
for attempt in $(seq 1 60); do
  if curl -sS --fail --max-time 3 "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  if [[ "${attempt}" == "60" ]]; then
    die "API never became healthy. Inspect with: docker compose logs backend"
  fi
  sleep 2
done
log "      API is healthy"

log "[5/6] Environment"
log "      API            http://localhost:${API_PORT}"
log "      Frontend       http://localhost:3000"
log "      PostgreSQL     postgres://postgres:postgres@localhost:5432/app"
log "      Load target    http://localhost:${LOAD_TARGET_PORT} (pods: ${TARGET_BASE_URL})"
log "      Runner callback ${CALLBACK_BASE_URL}"

if [[ "${SKIP_WORKER}" == "1" ]]; then
  log "[6/6] SKIP_WORKER=1 — not starting the worker"
  exit 0
fi

log "[6/6] Starting the outbox worker on this machine (Ctrl-C to stop)"
cd "${SCRIPT_DIR}/.."
exec env \
  DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/app}" \
  KUBERNETES_CONTEXT="${WORKLOAD_CONTEXT}" \
  KUBERNETES_NAMESPACE="${APP_NAMESPACE}" \
  RUNNER_CALLBACK_BASE_URL="${CALLBACK_BASE_URL}" \
  RUNNER_IMAGE="${RUNNER_IMAGE}" \
  RUNNER_SHARED_SECRET="${RUNNER_SHARED_SECRET:-local-runner-shared-secret}" \
  APP_KEY="${APP_KEY:-local-dev-app-key-change-me-in-production}" \
  NODE_ENV="${NODE_ENV:-development}" \
  PORT="${PORT:-${API_PORT}}" \
  HOST="${HOST:-0.0.0.0}" \
  LOG_LEVEL="${LOG_LEVEL:-info}" \
  APP_URL="${APP_URL:-http://localhost:${API_PORT}}" \
  SESSION_DRIVER="${SESSION_DRIVER:-cookie}" \
  npm --workspace backend run worker:dev
