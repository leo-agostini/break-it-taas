#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

POSTGRES_DB="${POSTGRES_DB:-app}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"

kube -n "${DATA_NAMESPACE}" create secret generic postgres-auth \
  --from-literal=POSTGRES_DB="${POSTGRES_DB}" \
  --from-literal=POSTGRES_USER="${POSTGRES_USER}" \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --dry-run=client -o yaml | kube apply -f -

log "Applied postgres-auth secret in namespace '${DATA_NAMESPACE}'"
