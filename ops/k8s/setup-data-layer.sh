#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

log "Applying namespaces and limits"
kube apply -f ops/k8s/base/00-namespaces.yaml
kube apply -f ops/k8s/base/01-limits.yaml
bash ops/k8s/apply-data-secrets.sh

log "Deploying PostgreSQL"
kube apply -f ops/k8s/data/postgres.yaml
kube rollout status statefulset/postgres -n data --timeout=240s

log "Configuring backups and restore check"
kube apply -f ops/k8s/data/postgres-backup.yaml

log "Running immediate backup dry run"
kube create job --from=cronjob/postgres-backup postgres-backup-now -n data
kube wait --for=condition=complete job/postgres-backup-now -n data --timeout=240s

log "Running restore validation"
kube delete job postgres-restore-check -n data --ignore-not-found=true
kube apply -f ops/k8s/data/postgres-restore-check.yaml
kube wait --for=condition=complete job/postgres-restore-check -n data --timeout=240s

log "Data layer ready"
kube get pods -n data
