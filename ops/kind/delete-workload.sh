#!/usr/bin/env bash
# Tears down the local kind workload cluster.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib.sh"

require_command kind

if ! kind get clusters 2>/dev/null | grep -qx "${WORKLOAD_CLUSTER_NAME}"; then
  log "Cluster '${WORKLOAD_CLUSTER_NAME}' does not exist — nothing to do"
  exit 0
fi

log "Deleting kind cluster '${WORKLOAD_CLUSTER_NAME}'"
kind delete cluster --name "${WORKLOAD_CLUSTER_NAME}"
log "Done"
