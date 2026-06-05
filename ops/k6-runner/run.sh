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
  if ! k6 run --summary-export /tmp/summary.json /k6-runner/script.js; then
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
