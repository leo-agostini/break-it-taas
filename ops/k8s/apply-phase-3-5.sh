#!/usr/bin/env bash
set -euo pipefail

WORKLOAD_CONTEXT="${WORKLOAD_CONTEXT:-k3d-workload}"

echo "Applying namespaces and limits"
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/base/00-namespaces.yaml
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/base/01-limits.yaml
bash ops/k8s/apply-data-secrets.sh

echo "Deploying PostgreSQL"
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/data/postgres.yaml
kubectl --context "${WORKLOAD_CONTEXT}" rollout status statefulset/postgres -n data --timeout=240s

echo "Configuring backups and restore check"
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/data/postgres-backup.yaml

echo "Running immediate backup dry run"
kubectl --context "${WORKLOAD_CONTEXT}" create job --from=cronjob/postgres-backup postgres-backup-now -n data
kubectl --context "${WORKLOAD_CONTEXT}" wait --for=condition=complete job/postgres-backup-now -n data --timeout=240s

echo "Running restore validation"
kubectl --context "${WORKLOAD_CONTEXT}" delete job postgres-restore-check -n data --ignore-not-found=true
kubectl --context "${WORKLOAD_CONTEXT}" apply -f ops/k8s/data/postgres-restore-check.yaml
kubectl --context "${WORKLOAD_CONTEXT}" wait --for=condition=complete job/postgres-restore-check -n data --timeout=240s

echo "Phase 3-5 completed"
kubectl --context "${WORKLOAD_CONTEXT}" get pods -n data
