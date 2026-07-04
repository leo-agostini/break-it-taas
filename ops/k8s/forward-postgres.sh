#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

POSTGRES_PORT_FORWARD="${POSTGRES_PORT_FORWARD:-5432}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"

log "Forwarding ${DATA_NAMESPACE}/${POSTGRES_SERVICE}:5432 to localhost:${POSTGRES_PORT_FORWARD}"
kube -n "${DATA_NAMESPACE}" port-forward "svc/${POSTGRES_SERVICE}" "${POSTGRES_PORT_FORWARD}:5432"
