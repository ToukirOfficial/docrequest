# 001 — Auth cookies and cross-site protection

**Decision:** Access and refresh tokens live in `httpOnly` cookies with `SameSite=Lax` (`Secure` in production). Every state-changing request (POST, PUT, PATCH, DELETE) passes NestJS 12's built-in `enableCsrfProtection()`, which rejects cross-site requests using `Sec-Fetch-Site` with an `Origin` fallback. The web app's origin is the only trusted origin.

**Why:** `SameSite=Strict` would drop cookies when staff click a link in an email, so they'd look signed out. `Lax` keeps that working, and the Origin check closes the cross-site write gap that `Lax` leaves open.

**Also:** the browser only talks to the Next.js origin; `/api/*` is proxied to NestJS, so cookies are first-party. NestJS 12's built-in cookie and security-header support replaced `cookie-parser` and `helmet`.
