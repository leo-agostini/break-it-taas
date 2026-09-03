#!/bin/sh
set -eu

required_vars="TEST_RUN_ID CALLBACK_URL RUNNER_SHARED_SECRET RUN_CONFIG_JSON RUN_CONFIG_HMAC RUNTIME_REF"
for v in $required_vars; do
  eval "value=\${$v:-}"
  if [ -z "$value" ]; then
    echo "Missing required env: $v" >&2
    exit 1
  fi
done

calc_hmac() {
  printf '%s' "$1" | openssl dgst -sha256 -hmac "$RUNNER_SHARED_SECRET" -binary | xxd -p -c 256
}

status="SUCCEEDED"
error_message=""

actual_hmac="$(calc_hmac "$RUN_CONFIG_JSON")"
if [ "$actual_hmac" != "$RUN_CONFIG_HMAC" ]; then
  status="FAILED"
  error_message="config_hmac_mismatch"
else
  # The config is HMAC-verified above, so reading the test type back out of it
  # needs no separate (unsigned) env var.
  is_breakpoint=0
  case "$RUN_CONFIG_JSON" in
    *'"testType":"BREAKPOINT"'*) is_breakpoint=1 ;;
  esac

  # script.js writes /tmp/summary.json from handleSummary; passing
  # --summary-export as well would put two writers on the same path.
  exit_code=0
  k6 run /k6-runner/script.js || exit_code=$?

  if [ "$exit_code" -eq 99 ]; then
    # k6 exit 99 means a threshold was breached. For a breakpoint test that is
    # the point of the run — it found the system's limit — so it is not a
    # failure. For every other type, a breached threshold is a real failure.
    if [ "$is_breakpoint" -eq 1 ]; then
      status="SUCCEEDED"
    else
      status="FAILED"
      error_message="thresholds_breached"
    fi
  elif [ "$exit_code" -ne 0 ]; then
    status="FAILED"
    error_message="k6_execution_failed"
  fi
fi

summary="{}"
if [ -f /tmp/summary.json ]; then
  summary="$(cat /tmp/summary.json)"
fi

completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

payload=$(cat <<EOF
{"testRunId":"${TEST_RUN_ID}","status":"${status}","resultSummary":{"summary":${summary},"error":"${error_message}"},"artifacts":["summary.json"],"runtimeRef":"${RUNTIME_REF}","completedAt":"${completed_at}"}
EOF
)

timestamp="$(date +%s)"
signature="sha256=$(printf '%s.%s' "$timestamp" "$payload" | openssl dgst -sha256 -hmac "$RUNNER_SHARED_SECRET" -binary | xxd -p -c 256)"

curl -sS -X POST "$CALLBACK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Runner-Timestamp: ${timestamp}" \
  -H "X-Runner-Signature: ${signature}" \
  --data "$payload" >/tmp/callback.out || true

if [ "$status" != "SUCCEEDED" ]; then
  exit 1
fi
