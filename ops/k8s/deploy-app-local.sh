#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

BACKEND_IMAGE="${BACKEND_IMAGE:-breakit-backend:local}"
RUNNER_IMAGE="${RUNNER_IMAGE:-breakit-k6-runner:local}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-breakit-frontend:local}"
INGRESS_HTTP_PORT="${INGRESS_HTTP_PORT:-80}"

log "Building backend image ${BACKEND_IMAGE}"
docker build -t "${BACKEND_IMAGE}" backend

log "Building runner image ${RUNNER_IMAGE}"
docker build -t "${RUNNER_IMAGE}" ops/k6-runner

log "Building frontend image ${FRONTEND_IMAGE}"
docker build -t "${FRONTEND_IMAGE}" -f frontend/Dockerfile .

log "Importing images into k3d cluster ${WORKLOAD_CLUSTER_NAME}"
k3d image import "${BACKEND_IMAGE}" -c "${WORKLOAD_CLUSTER_NAME}"
k3d image import "${RUNNER_IMAGE}" -c "${WORKLOAD_CLUSTER_NAME}"
k3d image import "${FRONTEND_IMAGE}" -c "${WORKLOAD_CLUSTER_NAME}"

log "Applying app manifests"
bash ops/k8s/apply-app-secrets.sh
kube apply -f ops/k8s/app/app-config.yaml
kube apply -f ops/k8s/app/worker-rbac.yaml
kube apply -f ops/k8s/app/backend-deployment.yaml
kube apply -f ops/k8s/app/backend-service.yaml
kube apply -f ops/k8s/app/backend-ingress.yaml
kube apply -f ops/k8s/app/outbox-worker-deployment.yaml
kube apply -f ops/k8s/app/load-target.yaml
kube apply -f ops/k8s/app/frontend-deployment.yaml
kube apply -f ops/k8s/app/frontend-service.yaml
kube apply -f ops/k8s/app/frontend-nginx-configmap.yaml
kube apply -f ops/k8s/app/frontend-nginx-deployment.yaml
kube apply -f ops/k8s/app/frontend-nginx-service.yaml
kube apply -f ops/k8s/app/frontend-ingress.yaml

log "Waiting for rollouts"
kube -n "${APP_NAMESPACE}" rollout status deployment/backend --timeout=240s
kube -n "${APP_NAMESPACE}" rollout status deployment/outbox-worker --timeout=240s
kube -n "${APP_NAMESPACE}" rollout status deployment/load-target --timeout=240s
kube -n "${APP_NAMESPACE}" rollout status deployment/frontend --timeout=240s
kube -n "${APP_NAMESPACE}" rollout status deployment/frontend-nginx --timeout=240s

log "Verifying service endpoints and pods"
kube -n "${APP_NAMESPACE}" get pods -o wide
kube -n "${APP_NAMESPACE}" get svc backend
kube -n "${APP_NAMESPACE}" get endpoints backend
kube -n "${APP_NAMESPACE}" get svc frontend frontend-nginx

log "Health checks through ingress"
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

log "Done. Backend + frontend stack is running behind Ingress."
