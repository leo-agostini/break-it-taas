#!/usr/bin/env bash
set -euo pipefail

WORKLOAD_CONTEXT="${WORKLOAD_CONTEXT:-k3d-workload}"
DATA_NAMESPACE="${DATA_NAMESPACE:-data}"

POSTGRES_DB="${POSTGRES_DB:-taas}"
POSTGRES_USER="${POSTGRES_USER:-appuser}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-apppassword}"

kubectl --context "${WORKLOAD_CONTEXT}" -n "${DATA_NAMESPACE}" create secret generic postgres-auth \
  --from-literal=POSTGRES_DB="${POSTGRES_DB}" \
  --from-literal=POSTGRES_USER="${POSTGRES_USER}" \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --dry-run=client -o yaml | kubectl --context "${WORKLOAD_CONTEXT}" apply -f -

echo "Applied postgres-auth secret in namespace '${DATA_NAMESPACE}'"
