#!/usr/bin/env bash
# Shared defaults and helpers for ops scripts.
# Source this file; do not execute it directly.

# Local clusters are kind. kind derives its kubectl context name as
# kind-<cluster>, so these two defaults must stay in lockstep; the bootstrap
# script enforces that.
WORKLOAD_CLUSTER_NAME="${WORKLOAD_CLUSTER_NAME:-taas-dev}"
WORKLOAD_CONTEXT="${WORKLOAD_CONTEXT:-kind-taas-dev}"
APP_NAMESPACE="${APP_NAMESPACE:-app}"

# Timestamped log line
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

# Fatal error
die() {
  printf '[%s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2
  exit 1
}

# Abort with an actionable message when a required binary is missing
require_command() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not installed or not on PATH."
}

# The backend (and its outbox worker) runs on AdonisJS v7, which needs Node 24.
# `nvm use` in the repo root picks it up from .nvmrc.
require_node_24() {
  require_command node
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "${major}" -ge 24 ]] ||
    die "Node 24+ is required (found $(node --version)). Run: nvm install && nvm use"
}

# kubectl shorthand — always targets the workload cluster context explicitly,
# never the ambient current-context
kube() { kubectl --context "${WORKLOAD_CONTEXT}" "$@"; }

# IP that cluster pods can use to reach services listening on the host.
#
# kind attaches its nodes to its own Docker network ("kind"), so the default
# bridge gateway (172.17.0.1, which k3d used) does not apply. Anything running
# on the host and consumed from inside the cluster goes through this address:
# the runner callback API, and PostgreSQL when it runs in Docker Compose.
host_gateway() {
  local network="${KIND_NETWORK:-kind}"
  # The kind network carries both an IPv6 and an IPv4 subnet. Ranging over
  # IPAM.Config emits both gateways with no separator, which yields a garbage
  # address like 'fc00:...::1172.18.0.1'. Print one per line and keep the IPv4
  # one — that is what host processes bind on.
  docker network inspect "${network}" \
    --format '{{range .IPAM.Config}}{{if .Gateway}}{{println .Gateway}}{{end}}{{end}}' 2>/dev/null \
    | grep -m1 -E '^[0-9]+(\.[0-9]+){3}$' || true
}
