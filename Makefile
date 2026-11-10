# Thin wrappers over the ops/ scripts. Every target loads root .env through
# ops/run-with-env.sh so the cluster name and context are the same for everyone.

.PHONY: up up-obs down down-all smoke cluster-up cluster-down

## Start everything (Compose stack + kind cluster) and run the worker here
up:
	bash ops/run-with-env.sh bash ops/dev-up.sh

## Same as `up`, plus Grafana/Prometheus/Loki/Tempo and API + browser telemetry
up-obs:
	OBSERVABILITY=1 bash ops/run-with-env.sh bash ops/dev-up.sh

## Stop the Compose stack, leave the cluster running
down:
	bash ops/run-with-env.sh bash ops/dev-down.sh

## Stop the Compose stack and delete the cluster
down-all:
	bash ops/run-with-env.sh bash ops/dev-down.sh --cluster

## End-to-end smoke test (requires `make up` running in another terminal)
smoke:
	bash ops/run-with-env.sh bash ops/smoke-test.sh

## Cluster only, without the Compose stack or the worker
cluster-up:
	bash ops/run-with-env.sh bash ops/kind/bootstrap-workload.sh

cluster-down:
	bash ops/run-with-env.sh bash ops/kind/delete-workload.sh
