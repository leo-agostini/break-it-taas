#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

JWT_SECRET="${JWT_SECRET:-local-dev-secret-change-me}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-local-dev-refresh-secret-change-me}"
DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@postgres.data.svc.cluster.local:5432/app}"
RUNNER_SHARED_SECRET="${RUNNER_SHARED_SECRET:-local-runner-shared-secret}"
COOKIE_SAMESITE="${COOKIE_SAMESITE:-Lax}"
COOKIE_SECURE="${COOKIE_SECURE:-false}"

kube -n "${APP_NAMESPACE}" create secret generic app-env \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}" \
  --from-literal=DATABASE_URL="${DATABASE_URL}" \
  --from-literal=RUNNER_SHARED_SECRET="${RUNNER_SHARED_SECRET}" \
  --from-literal=COOKIE_SAMESITE="${COOKIE_SAMESITE}" \
  --from-literal=COOKIE_SECURE="${COOKIE_SECURE}" \
  --dry-run=client -o yaml | kube apply -f -

log "Applied app-env secret in namespace '${APP_NAMESPACE}'"
