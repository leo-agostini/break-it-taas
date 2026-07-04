#!/usr/bin/env bash
# Shared defaults and helpers for ops scripts.
# Source this file; do not execute it directly.

WORKLOAD_CLUSTER_NAME="${WORKLOAD_CLUSTER_NAME:-workload}"
WORKLOAD_CONTEXT="${WORKLOAD_CONTEXT:-k3d-workload}"
APP_NAMESPACE="${APP_NAMESPACE:-app}"
DATA_NAMESPACE="${DATA_NAMESPACE:-data}"

# kubectl shorthand — always targets the workload cluster context
kube() { kubectl --context "${WORKLOAD_CONTEXT}" "$@"; }

# Timestamped log line
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
