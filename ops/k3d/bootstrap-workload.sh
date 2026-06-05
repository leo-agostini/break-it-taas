#!/usr/bin/env bash
set -euo pipefail

WORKLOAD_CLUSTER_NAME="${WORKLOAD_CLUSTER_NAME:-workload}"
HOST_HTTP_PORT="${HOST_HTTP_PORT:-80}"
HOST_HTTPS_PORT="${HOST_HTTPS_PORT:-443}"
SKIP_RANCHER_IMPORT="${SKIP_RANCHER_IMPORT:-0}"

if [[ "${SKIP_RANCHER_IMPORT}" != "1" && -z "${RANCHER_IMPORT_URL:-}" ]]; then
  echo "RANCHER_IMPORT_URL is required." >&2
  echo "Tip: set SKIP_RANCHER_IMPORT=1 for local-only setup without Rancher." >&2
  echo "Example: export RANCHER_IMPORT_URL='https://rancher.X.X.X.X.sslip.io/v3/import/<token>.yaml'" >&2
  exit 1
fi

echo "[1/4] Creating workload cluster '${WORKLOAD_CLUSTER_NAME}'"
k3d cluster create "${WORKLOAD_CLUSTER_NAME}" \
  --servers 1 \
  --agents 2 \
  --port "${HOST_HTTP_PORT}:80@loadbalancer" \
  --port "${HOST_HTTPS_PORT}:443@loadbalancer"

echo "[2/4] Switching kubectl context"
kubectl config use-context "k3d-${WORKLOAD_CLUSTER_NAME}" >/dev/null

if [[ "${SKIP_RANCHER_IMPORT}" == "1" ]]; then
  echo "[3/4] Skipping Rancher import (SKIP_RANCHER_IMPORT=1)"
  echo "[4/4] Local workload cluster ready"
else
  echo "[3/4] Importing cluster into Rancher"
  curl --insecure -sfL "${RANCHER_IMPORT_URL}" | kubectl apply -f -

  echo "[4/4] Waiting cluster agent rollout"
  kubectl -n cattle-system rollout status deploy/cattle-cluster-agent --timeout=180s
  kubectl -n cattle-system get pods
fi
