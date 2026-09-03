#!/usr/bin/env bash
# Creates (or reuses) the local kind cluster that runs k6 runner Jobs.
# Idempotent: safe to re-run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib.sh"

KIND_NODE_IMAGE="${KIND_NODE_IMAGE:-}"

require_command kind
require_command kubectl
require_command docker

if kind get clusters 2>/dev/null | grep -qx "${WORKLOAD_CLUSTER_NAME}"; then
  log "Cluster '${WORKLOAD_CLUSTER_NAME}' already exists — reusing it"
else
  log "Creating kind cluster '${WORKLOAD_CLUSTER_NAME}'"
  create_args=(create cluster --name "${WORKLOAD_CLUSTER_NAME}"
    --config "${SCRIPT_DIR}/kind-config.yaml" --wait 120s)
  if [[ -n "${KIND_NODE_IMAGE}" ]]; then
    create_args+=(--image "${KIND_NODE_IMAGE}")
  fi
  kind "${create_args[@]}"
fi

# kind always names the context kind-<cluster>. Fail early on a mismatch rather
# than letting later commands act on the wrong cluster.
expected_context="kind-${WORKLOAD_CLUSTER_NAME}"
if [[ "${WORKLOAD_CONTEXT}" != "${expected_context}" ]]; then
  die "WORKLOAD_CONTEXT is '${WORKLOAD_CONTEXT}' but kind created '${expected_context}'. Fix .env so they agree."
fi
if ! kubectl config get-contexts -o name | grep -qx "${WORKLOAD_CONTEXT}"; then
  die "Context '${WORKLOAD_CONTEXT}' is missing from kubeconfig after cluster creation."
fi

log "Cluster '${WORKLOAD_CLUSTER_NAME}' ready on context '${WORKLOAD_CONTEXT}'"
