#!/usr/bin/env bash
# Verifies that a host address is reachable from inside the cluster, which is
# what runner pods need in hybrid mode to POST their results back to the API.
#
# Usage: bash ops/kind/probe-callback.sh [callback-base-url]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib.sh"

require_command kubectl
require_command docker

CALLBACK_BASE_URL="${1:-${RUNNER_CALLBACK_BASE_URL:-}}"

if [[ -z "${CALLBACK_BASE_URL}" ]]; then
  gateway="$(host_gateway)"
  [[ -n "${gateway}" ]] || die "Pass a callback base URL, or set RUNNER_CALLBACK_BASE_URL."
  CALLBACK_BASE_URL="http://${gateway}:3001"
  log "No URL given; probing the kind network gateway at ${CALLBACK_BASE_URL}"
fi

log "Probing ${CALLBACK_BASE_URL}/api/health from inside ${WORKLOAD_CONTEXT}"
if kube -n "${APP_NAMESPACE}" run callback-probe-$$ --rm -i --quiet \
  --restart=Never --image=curlimages/curl:8.10.1 -- \
  curl -sS --max-time 10 "${CALLBACK_BASE_URL}/api/health"; then
  echo
  log "Reachable. Use RUNNER_CALLBACK_BASE_URL=${CALLBACK_BASE_URL} in backend/.env"
else
  echo
  die "Not reachable from cluster pods. On Docker Desktop try http://host.docker.internal:3001, or another host IP."
fi
