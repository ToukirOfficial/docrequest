# 002 — Login codes and refresh token rotation

**Login:** password first (argon2id), then a 6-digit code emailed for every login. The code is stored in Redis as an HMAC (keyed by `CODE_PEPPER`), tied to a random challenge id held in a short-lived `httpOnly` cookie. 5 wrong tries kills the challenge. Rate limits apply per IP and per email.

**Refresh:** refresh tokens are random, stored only as SHA-256 hashes, and rotated on every use. Each login starts a "family". If an already-used token is presented again, the whole family is revoked and the event is audited: that only happens when a token has been copied.
