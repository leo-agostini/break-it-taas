#!/bin/sh
set -eu

if [ -z "${TEST_RUN_ID:-}" ] || [ -z "${CALLBACK_URL:-}" ] || [ -z "${RUNNER_SHARED_SECRET:-}" ] || [ -z "${RUNTIME_REF:-}" ]; then
  echo "Missing required env vars" >&2
  exit 1
fi

sleep_seconds=$(( (RANDOM % 7) + 3 ))
sleep "${sleep_seconds}"

value=$(( (RANDOM % 1000) + 1 ))
if [ $((value % 5)) -eq 0 ]; then
  status="FAILED"
else
  status="SUCCEEDED"
fi

completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

payload=$(cat <<EOF
{"testRunId":"${TEST_RUN_ID}","status":"${status}","resultSummary":{"randomValue":${value},"sleepSeconds":${sleep_seconds}},"artifacts":["stdout.log"],"runtimeRef":"${RUNTIME_REF}","completedAt":"${completed_at}"}
EOF
)

timestamp="$(date +%s)"
signature="sha256=$(printf '%s.%s' "$timestamp" "$payload" | openssl dgst -sha256 -hmac "$RUNNER_SHARED_SECRET" -binary | xxd -p -c 256)"

attempt=1
max_attempts=5
while [ "$attempt" -le "$max_attempts" ]; do
  http_code=$(curl -sS -o /tmp/callback-response.txt -w '%{http_code}' \
    -X POST "$CALLBACK_URL" \
    -H "Content-Type: application/json" \
    -H "X-Runner-Timestamp: ${timestamp}" \
    -H "X-Runner-Signature: ${signature}" \
    --data "$payload" || true)

  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    exit 0
  fi

  attempt=$((attempt + 1))
  sleep $((attempt * 2))
done

cat /tmp/callback-response.txt >&2 || true
exit 1
