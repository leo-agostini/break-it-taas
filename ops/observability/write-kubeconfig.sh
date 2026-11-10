#!/usr/bin/env bash
# Gives the Compose observability stack (Alloy, kube-state-metrics) read-only
# access to the kind cluster, without running anything inside it.
#
# Applies the telemetry-reader ServiceAccount and writes its token, the cluster
# CA and a kubeconfig into ops/observability/.kube/ (gitignored), which
# docker-compose.yml mounts at /etc/kube. The kubeconfig targets the API server
# by its in-network name, <cluster>-control-plane:6443: those containers join
# the `kind` Docker network, and that is the address the serving cert covers.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib.sh"

require_command kubectl

OUT_DIR="${SCRIPT_DIR}/.kube"
SERVER="https://${WORKLOAD_CLUSTER_NAME}-control-plane:6443"

log "Applying the telemetry-reader ServiceAccount"
kube apply -f "${SCRIPT_DIR}/../k8s/observability/telemetry-reader.yaml" >/dev/null

# The token controller fills the Secret asynchronously.
token=""
for _ in $(seq 1 30); do
  token="$(kube -n kube-system get secret telemetry-reader-token -o jsonpath='{.data.token}' 2>/dev/null || true)"
  [[ -n "${token}" ]] && break
  sleep 1
done
[[ -n "${token}" ]] || die "The telemetry-reader token was never issued."

mkdir -p "${OUT_DIR}"
printf '%s' "${token}" | base64 --decode >"${OUT_DIR}/token"
kube -n kube-system get secret telemetry-reader-token -o jsonpath='{.data.ca\.crt}' |
  base64 --decode >"${OUT_DIR}/ca.crt"

# Paths are the in-container mount point, not this directory.
cat >"${OUT_DIR}/config" <<EOF
apiVersion: v1
kind: Config
clusters:
  - name: ${WORKLOAD_CLUSTER_NAME}
    cluster:
      server: ${SERVER}
      certificate-authority: /etc/kube/ca.crt
users:
  - name: telemetry-reader
    user:
      tokenFile: /etc/kube/token
contexts:
  - name: telemetry-reader
    context:
      cluster: ${WORKLOAD_CLUSTER_NAME}
      user: telemetry-reader
current-context: telemetry-reader
EOF

log "Wrote ${OUT_DIR}/{config,token,ca.crt} (server ${SERVER})"
