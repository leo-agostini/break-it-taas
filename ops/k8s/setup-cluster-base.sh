#!/usr/bin/env bash
# Applies the cluster-wide basics the app manifests assume: namespaces and
# default resource limits.
#
# PostgreSQL is deliberately absent. It runs in Docker Compose locally and as a
# separate infrastructure component elsewhere, so the cluster holds no data
# layer and no backup/restore jobs.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

require_command kubectl

log "Applying namespaces and limits"
kube apply -f ops/k8s/base/00-namespaces.yaml
kube apply -f ops/k8s/base/01-limits.yaml

log "Cluster base ready"
kube get namespaces app tests
