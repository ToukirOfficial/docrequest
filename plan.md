# DocRequest — Build plan

Source of truth: `PRD.md`. Stack and rules: the project rules. Status: **waiting for go**.

## Data model (Prisma, PostgreSQL 18)

Every table: UUIDv7 `id`, `createdAt`, `updatedAt` (UTC). Every tenant table has `workspaceId` + index.

| Table | Key fields |
|---|---|
| `User` | email (unique), passwordHash (argon2id), name |
| `Workspace` | name, reminderDays `int[]` (default `{2,5,7}`), dueReminderDays (default 1), retentionDays (default 30), linkExpiryDays (default 30) |
| `Membership` | userId, workspaceId, role `OWNER/ADMIN/STAFF` — unique (userId, workspaceId) |
| `Invite` | workspaceId, email, role, tokenHash, expiresAt, acceptedAt |
| `RefreshToken` | userId, familyId, tokenHash, expiresAt, revokedAt, replacedById (reuse of a used token revokes the whole family) |
| `Template` | workspaceId (null = built-in), name |
| `TemplateItem` | templateId, position, title, helpText, required, allowedTypes `enum[]` (PDF/JPEG/PNG/HEIC) |
| `Request` | workspaceId, createdById, clientName, clientEmail, dueDate?, message?, status `DRAFT/SENT/IN_PROGRESS/COMPLETE/EXPIRED`, linkHash (unique), linkExpiresAt, sentAt, completedAt, expiredAt, filesDeletedAt |
| `RequestItem` | requestId, workspaceId, position, title, helpText, required, allowedTypes, status `PENDING/SUBMITTED/ACCEPTED/REJECTED`, rejectReason |
| `File` | requestItemId, workspaceId, storageKey (random), wrappedKey, iv, authTag, mimeType, size, originalExt, scanStatus `PENDING/CLEAN/INFECTED/SKIPPED`, deletedAt |
| `Reminder` | requestId, kind (`DAY_2`, `DUE`, `MANUAL`…), sentAt — unique (requestId, kind) for auto kinds, so a reminder can never send twice |
| `Export` | requestId, workspaceId, storageKey, status, expiresAt (zip removed after 1 hour) |
| `AuditLog` | workspaceId, actorType `USER/CLIENT/SYSTEM`, actorId?, action, entityType, entityId, at — append-only (DB trigger blocks UPDATE/DELETE, added via a Prisma `--create-only` migration). Never file names or client details. |

**Overdue** is not stored: it is `dueDate < now` and status SENT/IN_PROGRESS, applied in the list query. Login codes, client codes and client sessions live in Redis (short TTL, hashed, max 5 attempts).

## NestJS modules (`apps/api`)

- `auth` — signup, login step 1 (password) → step 2 (6-digit email code) → access JWT (15 min) + rotating refresh (30 days), both `httpOnly Secure SameSite=Strict` cookies. Logout, password reset. Global `AuthGuard` (deny by default, `@Public()`), `RolesGuard` (`@Roles()`), membership loaded per request from `/w/:workspaceId/...`.
- `workspaces` — settings, members, invites, role changes (Owner can't be removed or demoted by Admin).
- `templates` — CRUD + 5 built-in templates (seeded, copyable, read-only).
- `requests` — create (from template or blank), edit items, send, resend link, list with filters/search, cancel.
- `client` — public link endpoints: open link, request code, verify code → client session cookie scoped to one request; checklist; upload.
- `files` — storage adapter (`local` | `s3`), envelope encryption (`env` | `kms` master key), upload validation (magic bytes, size), stream-decrypt preview/download.
- `review` — accept/reject item, completion check, zip export.
- `reminders` — scheduling sweep + manual send.
- `retention` — expiry and file deletion sweep.
- `audit` — write helper + read endpoint (Owner/Admin).
- `mail` — templates; drivers `smtp` | `file` (file = demo/dev mail folder).
- `demo` — seed, mail viewer, hourly upload purge, nightly reset (only when `DEMO_MODE=true`).
- `worker` (same app, separate entry) — BullMQ queues: `mail`, `scan` (ClamAV clamd INSTREAM, small client written in-house), `convert` (HEIC→JPEG, resize big images), `export` (zip), `sweeps` (repeatable: reminders hourly, expiry + retention daily, demo jobs).
- Rate limiting: small Redis fixed-window guard (`@RateLimit()`) on login, code send/verify, password reset, link opens, uploads.

Validation: Zod schemas in `packages/shared`, passed to NestJS 12's `@Body/@Query/@Param({ schema })`; unknown fields stripped. Response DTOs mapped explicitly.

## API endpoints (prefix `/api`)

```
POST auth/signup · auth/login · auth/login/verify · auth/refresh · auth/logout
POST auth/password/forgot · auth/password/reset · GET auth/me
GET  invites/:token  · POST invites/:token/accept                      (public)
GET/PATCH w/:wid/settings                                               (Owner/Admin)
GET  w/:wid/members · PATCH/DELETE w/:wid/members/:id · POST w/:wid/invites (Owner/Admin)
GET/POST w/:wid/templates · GET/PATCH/DELETE w/:wid/templates/:id        (write: Owner/Admin)
GET/POST w/:wid/requests · GET/PATCH/DELETE w/:wid/requests/:id
PUT  w/:wid/requests/:id/items · POST w/:wid/requests/:id/send|remind|cancel
POST w/:wid/requests/:id/items/:itemId/accept|reject
GET  w/:wid/files/:fileId (stream, audited)
POST w/:wid/requests/:id/export · GET w/:wid/exports/:id · GET w/:wid/exports/:id/download
GET  w/:wid/audit                                                       (Owner/Admin)
POST client/open · client/code · client/verify                          (public, rate-limited)
GET  client/request · POST client/items/:itemId/files · DELETE client/files/:id (client session)
GET  demo/mail                                                          (public, DEMO_MODE only)
```

## Pages (`apps/web`, shadcn/ui; `/api/*` proxied to the API so cookies stay first-party)

Staff: `/login`, `/login/code`, `/signup`, `/forgot-password`, `/reset-password`, `/invite/[token]`, `/app` (requests dashboard: status filter, search), `/app/requests/new`, `/app/requests/[id]` (items, previews, accept/reject, zip, remind), `/app/templates`, `/app/templates/[id]`, `/app/team`, `/app/settings`, `/app/audit`.
Client (mobile-first, WCAG 2.2 AA): `/r/[token]` → code entry → checklist with camera/file upload per item, progress bar, rejection reasons. Demo: banner on all pages, `/demo/mail`.

## Phases

**Phase 1 — Foundations, auth, workspaces, roles.** pnpm + Turborepo monorepo, strict TS, ESLint/Prettier, GitHub Actions CI, dev `docker-compose` (Postgres, Redis). Prisma: User, Workspace, Membership, Invite, RefreshToken, AuditLog. Auth flow with email code, refresh rotation + reuse detection, password reset, global guards, rate limiter, mail queue + worker, team/invite/settings. Web: auth pages, app shell, team, settings.
Tests: login + code + refresh/reuse, role rules, workspace isolation, rate limits.

**Phase 2 — Templates and requests.** Template/Request models, 5 built-in templates, create/edit/send request, secure link (32 random bytes, SHA-256 hash, expiry), request email, dashboard with filters/search/overdue.
Tests: isolation + roles on templates/requests, link stored only as hash.

**Phase 3 — Client upload and secure storage.** Client link → code → session, storage adapter (local/S3), AES-256-GCM per-file key wrapped by master key (env or KMS), magic-byte type check, size limit, scan + convert jobs (scan switchable by `CLAMAV_ENABLED`), client upload UI.
Tests: link/code security (expiry, wrong code, attempts, session scoped to one request), encryption round-trip, wrong-key fails.

**Phase 4 — Review and download.** Preview through API (only `CLEAN`/`SKIPPED` files), accept/reject with reason, completion rule, zip export job with clean names (`smith-jane_passport.pdf`), audit entries + audit page.
Tests: file access permissions and isolation, completion rule.

**Phase 5 — Reminders, expiry, retention.** Hourly reminder sweep (workspace schedule + before-due, stop on complete, idempotent), manual remind, daily expiry + retention deletion with audit log.
Tests: reminder scheduling, retention deletion.

**Phase 6 — Demo mode and self-hosting.** Demo seed with fake files, banner, mail viewer, 2 MB limit, hourly purge, nightly reset. Dockerfiles + full `docker-compose.yml` (web, api, worker, postgres, redis, clamav). `infra/aws` Terraform (S3, KMS, RDS, small EC2) + teardown. README per PRD §5, `ASSUMPTIONS.md`, `docs/decisions/`.

Each phase ends with: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, security sweep, `pnpm audit`, then marked done here.

## New libraries — need your OK (approving this plan approves them)

`argon2` (passwords) · `@nestjs/jwt` (access tokens) · `nodemailer` (email) · `file-type` (content type check) · `sharp` (resize) · `heic-convert` (HEIC→JPEG; sharp's prebuilt binaries don't decode HEIC) · `archiver` (zip) · `@aws-sdk/client-s3`, `@aws-sdk/client-kms` (optional drivers) · `cookie-parser` and `helmet` (skipped if NestJS 12.1 built-ins cover cookies and headers).

## Assumptions to confirm

1. **Signup:** open signup creates a workspace + Owner; self-hosters can switch it off with `SIGNUP_ENABLED=false`.
2. **Password reset** is included (not in PRD, but the project rules rule 4 expects it).
3. One user can belong to several workspaces; workspace is chosen in the UI.
4. Default link expiry 30 days after sending (or 7 days after due date, whichever is later).
5. This container has Node 22, not 24. I'll target Node 24 (`engines`, Dockerfiles, CI) and run locally on 22.
