#!/usr/bin/env bash
set -euo pipefail

MGMT_CLUSTER_NAME="${MGMT_CLUSTER_NAME:-mgmt}"
RANCHER_BOOTSTRAP_PASSWORD="${RANCHER_BOOTSTRAP_PASSWORD:-adminadmin}"
DOCKER_BRIDGE_GATEWAY="${DOCKER_BRIDGE_GATEWAY:-$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}')}"
RANCHER_HOSTNAME="${RANCHER_HOSTNAME:-rancher.${DOCKER_BRIDGE_GATEWAY}.sslip.io}"
HOST_HTTP_PORT="${HOST_HTTP_PORT:-80}"
HOST_HTTPS_PORT="${HOST_HTTPS_PORT:-443}"

echo "[1/5] Creating k3d management cluster '${MGMT_CLUSTER_NAME}'"
k3d cluster create "${MGMT_CLUSTER_NAME}" \
  --servers 1 \
  --agents 1 \
  --port "${HOST_HTTP_PORT}:80@loadbalancer" \
  --port "${HOST_HTTPS_PORT}:443@loadbalancer"

echo "[2/5] Installing cert-manager"
kubectl config use-context "k3d-${MGMT_CLUSTER_NAME}" >/dev/null
helm repo add jetstack https://charts.jetstack.io >/dev/null
helm repo update >/dev/null
kubectl create namespace cert-manager --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --set crds.enabled=true
kubectl -n cert-manager rollout status deployment/cert-manager --timeout=180s

echo "[3/5] Installing Rancher on hostname ${RANCHER_HOSTNAME}"
helm repo add rancher-latest https://releases.rancher.com/server-charts/latest >/dev/null
helm repo update >/dev/null
kubectl create namespace cattle-system --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install rancher rancher-latest/rancher \
  --namespace cattle-system \
  --set hostname="${RANCHER_HOSTNAME}" \
  --set bootstrapPassword="${RANCHER_BOOTSTRAP_PASSWORD}" \
  --set replicas=1

echo "[4/5] Waiting Rancher deployment"
kubectl -n cattle-system rollout status deployment/rancher --timeout=300s

echo "[5/5] Done"
echo "Rancher URL: https://${RANCHER_HOSTNAME}"
echo "Default login: admin / ${RANCHER_BOOTSTRAP_PASSWORD}"
