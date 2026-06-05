# HMAC Explained (for This Project)

## 1. What is HMAC?

**HMAC** means Hash-based Message Authentication Code.

It is a way to verify:
1. **Integrity**: message was not modified
2. **Authenticity**: sender knows the shared secret

It does **not** encrypt the message.
It only proves "this payload is authentic and unchanged."

---

## 2. HMAC Formula (Conceptual)

Given:
- message `M`
- secret key `K`
- hash function (here SHA-256)

HMAC output:
`HMAC_SHA256(K, M)`

If sender and receiver compute the same value, the message is trusted.

---

## 3. How We Used HMAC Here

In runner callback:
- Runner builds callback payload JSON.
- Runner computes signature using shared secret.
- Runner sends:
  - `X-Runner-Timestamp`
  - `X-Runner-Signature`

Backend receives callback and:
- Recomputes expected signature from timestamp + payload + secret
- Compares with provided signature
- Rejects callback if mismatch

Why:
- Prevent forged callback completion.
- Prevent accidental/malicious payload tampering.

---

## 4. Our Security Goals

HMAC in this flow protects against:
- fake completion callbacks
- modified result summaries in transit

Timestamp helps reduce replay-window risk (depending on validation policy).

---

## 5. Why HMAC Instead of JWT or mTLS Here?

For this internal callback:
- HMAC is simple, lightweight, and enough for shared-secret trust model.
- No token issuance lifecycle needed.
- Easy to implement in shell runner + backend.

Tradeoff:
- Shared secret must be protected and rotated operationally.

---

## 6. Minimal Pseudocode

### Runner side
```text
payload = JSON.stringify(callbackBody)
timestamp = unixTimeSeconds()
signature = HMAC_SHA256(secret, timestamp + "." + payload)
send headers:
  X-Runner-Timestamp: timestamp
  X-Runner-Signature: "sha256=" + hex(signature)
```

### Backend side
```text
read timestamp, signature, rawBody
expected = HMAC_SHA256(secret, timestamp + "." + rawBody)
if constantTimeCompare(signature, expected) == false:
    reject (401/403)
else:
    accept callback
```

---

## 7. Implementation Best Practices

- Use **constant-time comparison** to avoid timing attacks.
- Validate timestamp freshness (replay window).
- Keep shared secret in secure env/secret management.
- Rotate secrets periodically.
- Log failed verification attempts for auditing.

---

## 8. Common Mistakes

- Signing parsed JSON instead of raw body bytes (can change formatting/order).
- Not including timestamp in signed data.
- Comparing signatures with normal string compare.
- Exposing shared secret in logs or config files.
- Using very long replay windows.

---

## 9. Relation to Our Test Lifecycle

Without HMAC:
- Any actor able to call internal endpoint could fake a successful run.

With HMAC:
- Only trusted runner with secret can finalize run state and persist result.

This is why callback auth is a critical part of reliability and trust in asynchronous load-test execution.

---

## 10. Paper Defense Summary (Short Version)

"We used HMAC-SHA256 for runner-to-backend callback authentication.
Each callback includes a timestamp and signature over timestamp+payload.
Backend verifies signature with shared secret before updating run state.
This ensures integrity and authenticity of test completion data in our distributed execution pipeline."
