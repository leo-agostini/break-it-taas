#!/usr/bin/env bash
# Tears down what ops/dev-up.sh started.
#
# By default this stops the Compose stack and leaves the kind cluster in place,
# because recreating it is the slow part. Pass --cluster to delete that too.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

DELETE_CLUSTER=0
DELETE_VOLUMES=0
for arg in "$@"; do
  case "${arg}" in
    --cluster) DELETE_CLUSTER=1 ;;
    --volumes) DELETE_VOLUMES=1 ;;
    *) die "Unknown argument '${arg}'. Use --cluster and/or --volumes." ;;
  esac
done

require_command docker

log "Stopping the Compose stack"
if [[ "${DELETE_VOLUMES}" == "1" ]]; then
  log "  (--volumes: the PostgreSQL volume will be deleted)"
  docker compose down --volumes
else
  docker compose down
fi

if [[ "${DELETE_CLUSTER}" == "1" ]]; then
  bash "${SCRIPT_DIR}/kind/delete-workload.sh"
else
  log "Kind cluster '${WORKLOAD_CLUSTER_NAME}' left running (pass --cluster to delete it)"
fi

log "Done"
