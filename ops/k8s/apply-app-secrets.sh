#!/usr/bin/env bash
set -euo pipefail

WORKLOAD_CONTEXT="${WORKLOAD_CONTEXT:-k3d-workload}"
APP_NAMESPACE="${APP_NAMESPACE:-app}"

JWT_SECRET="${JWT_SECRET:-local-dev-secret-change-me}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-local-dev-refresh-secret-change-me}"
DATABASE_URL="${DATABASE_URL:-postgres://appuser:apppassword@postgres.data.svc.cluster.local:5432/taas}"
RUNNER_SHARED_SECRET="${RUNNER_SHARED_SECRET:-local-runner-shared-secret}"
COOKIE_SAMESITE="${COOKIE_SAMESITE:-Lax}"
COOKIE_SECURE="${COOKIE_SECURE:-false}"

kubectl --context "${WORKLOAD_CONTEXT}" -n "${APP_NAMESPACE}" create secret generic app-env \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}" \
  --from-literal=DATABASE_URL="${DATABASE_URL}" \
  --from-literal=RUNNER_SHARED_SECRET="${RUNNER_SHARED_SECRET}" \
  --from-literal=COOKIE_SAMESITE="${COOKIE_SAMESITE}" \
  --from-literal=COOKIE_SECURE="${COOKIE_SECURE}" \
  --dry-run=client -o yaml | kubectl --context "${WORKLOAD_CONTEXT}" apply -f -

echo "Applied app-env secret in namespace '${APP_NAMESPACE}'"
