#!/usr/bin/env bash
set -euo pipefail

WORKLOAD_CLUSTER_NAME="${WORKLOAD_CLUSTER_NAME:-workload}"
WORKLOAD_CONTEXT="${WORKLOAD_CONTEXT:-k3d-workload}"
BACKEND_IMAGE="${BACKEND_IMAGE:-breakit-backend:local}"
RUNNER_IMAGE="${RUNNER_IMAGE:-breakit-k6-runner:local}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-breakit-frontend:local}"
INGRESS_HTTP_PORT="${INGRESS_HTTP_PORT:-80}"

echo "[1/6] Building backend image ${BACKEND_IMAGE}"
docker build -t "${BACKEND_IMAGE}" backend

echo "[2/6] Building runner image ${RUNNER_IMAGE}"
docker build -t "${RUNNER_IMAGE}" ops/k6-runner

echo "[3/8] Building frontend image ${FRONTEND_IMAGE}"
docker build -t "${FRONTEND_IMAGE}" -f frontend/Dockerfile .

echo "[4/8] Importing images into k3d cluster ${WORKLOAD_CLUSTER_NAME}"
k3d image import "${BACKEND_IMAGE}" -c "${WORKLOAD_CLUSTER_NAME}"
k3d image import "${RUNNER_IMAGE}" -c "${WORKLOAD_CLUSTER_NAME}"
k3d image import "${FRONTEND_IMAGE}" -c "${WORKLOAD_CLUSTER_NAME}"

echo "[5/8] Applying app manifests"
bash ops/k8s/apply-app-secrets.sh
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/app-config.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/worker-rbac.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/backend-deployment.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/backend-service.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/backend-ingress.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/outbox-worker-deployment.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/load-target.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/frontend-deployment.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/frontend-service.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/frontend-nginx-configmap.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/frontend-nginx-deployment.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/frontend-nginx-service.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/app/frontend-ingress.yaml

echo "[6/8] Waiting for rollouts"
kubectl --context "${WORKLOAD_CONTEXT}" -n app rollout status deployment/backend --timeout=240s
kubectl --context "${WORKLOAD_CONTEXT}" -n app rollout status deployment/outbox-worker --timeout=240s
kubectl --context "${WORKLOAD_CONTEXT}" -n app rollout status deployment/load-target --timeout=240s
kubectl --context "${WORKLOAD_CONTEXT}" -n app rollout status deployment/frontend --timeout=240s
kubectl --context "${WORKLOAD_CONTEXT}" -n app rollout status deployment/frontend-nginx --timeout=240s

echo "[7/8] Verifying service endpoints and pods"
kubectl --context "${WORKLOAD_CONTEXT}" -n app get pods -o wide
kubectl --context "${WORKLOAD_CONTEXT}" -n app get svc backend
kubectl --context "${WORKLOAD_CONTEXT}" -n app get endpoints backend
kubectl --context "${WORKLOAD_CONTEXT}" -n app get svc frontend frontend-nginx

echo "[8/8] Health checks through ingress"
if [[ "${INGRESS_HTTP_PORT}" == "80" ]]; then
  API_BASE_URL="http://api.127.0.0.1.sslip.io"
  APP_BASE_URL="http://app.127.0.0.1.sslip.io"
else
  API_BASE_URL="http://api.127.0.0.1.sslip.io:${INGRESS_HTTP_PORT}"
  APP_BASE_URL="http://app.127.0.0.1.sslip.io:${INGRESS_HTTP_PORT}"
fi

for i in 1 2 3 4 5; do
  curl -sS "${API_BASE_URL}/api/health"
  echo
  curl -sS "${APP_BASE_URL}/api/health"
  echo
done

echo "Done. Backend + frontend stack is running behind Ingress."
