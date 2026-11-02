# DocRequest — Build plan

Source of truth: `PRD.md`. Stack and rules: the project rules. Status: **v1 complete** (all phases done).

## Data model (Prisma, PostgreSQL 18)

Every table: UUIDv7 `id`, `createdAt`, `updatedAt` (UTC). Every tenant table has `workspaceId` + index.

| Table | Key fields |
|---|---|
| `User` | email (unique), passwordHash (argon2id), name |
| `Workspace` | name, reminderDays `int[]` (default `{2,5,7}`), dueReminderDays (default 1), retentionDays (default 30), linkExpiryDays (default 30) |
| `Membership` | userId, workspaceId, role `OWNER/ADMIN/STAFF` — unique (userId, workspaceId) |
| `Invite` | workspaceId, email, role, tokenHash, expiresAt, acceptedAt |
| `RefreshToken` | userId, familyId, tokenHash, expiresAt, revokedAt, replacedById (reuse of a used token revokes the whole family) |
| `Template` | workspaceId, name (built-ins are in code, see `docs/decisions/003`) |
| `TemplateItem` | templateId, position, title, helpText, required, allowedTypes `enum[]` (PDF/JPEG/PNG/HEIC) |
| `Request` | workspaceId, createdById, checklistName, clientName, clientEmail, dueDate?, message?, status `DRAFT/SENT/IN_PROGRESS/COMPLETE/EXPIRED`, linkHash (unique), linkExpiresAt, sentAt, completedAt, expiredAt, filesDeletedAt |
| `RequestItem` | requestId, workspaceId, position, title, helpText, required, allowedTypes, status `PENDING/SUBMITTED/ACCEPTED/REJECTED`, rejectReason |
| `File` | requestItemId, workspaceId, storageKey (random), wrappedKey, iv, authTag, mimeType, size, originalExt, scanStatus `PENDING/CLEAN/INFECTED/SKIPPED`, deletedAt. Infected → stored bytes deleted, row kept with `INFECTED`, item back to `PENDING`, client sees "this file couldn't be accepted, please upload it again", audit entry. |
| `Reminder` | requestId, kind (`DAY_2`, `DUE`, `MANUAL:<time>`), emailed, sentById, sentAt — unique (requestId, kind), so a reminder can never send twice |
| `Export` | requestId, workspaceId, storageKey, wrappedKey, iv, authTag, status, expiresAt — zip encrypted with the same envelope encryption as uploads, deleted after 1 hour |
| `AuditLog` | workspaceId, actorType `USER/CLIENT/SYSTEM`, actorId?, action, entityType, entityId, requestId? (activity feed), at — append-only (DB trigger blocks UPDATE/DELETE, added via a Prisma `--create-only` migration). Never file names or client details. |

**Overdue** is not stored: it is `dueDate < now` and status SENT/IN_PROGRESS, applied in the list query. Login codes, client codes and client sessions live in Redis (short TTL, hashed, max 5 attempts).

## NestJS modules (`apps/api`)

- `auth` — signup, login step 1 (password) → step 2 (6-digit email code) → access JWT (15 min) + rotating refresh (30 days), both `httpOnly Secure SameSite=Lax` cookies, plus an Origin check on every state-changing request (POST/PUT/PATCH/DELETE) so links clicked from emails still work. Logout, password reset. Global `AuthGuard` (deny by default, `@Public()`), `RolesGuard` (`@Roles()`), membership loaded per request from `/w/:workspaceId/...`.
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
- `demo` — seed, one-click demo login, mail viewer, hourly upload purge, nightly reset (only when `DEMO_MODE=true`). In demo, signup is disabled and the demo workspace's settings and team are read-only.
- `worker` (same app, separate entry) — BullMQ queues: `mail`, `scan` (ClamAV clamd INSTREAM, small client written in-house), `convert` (concurrency 1: HEIC→JPEG, resize big images, re-encode every image with sharp to strip EXIF incl. GPS), `export` (zip), `sweeps` (repeatable: reminders hourly, expiry + retention daily, demo jobs).
- Rate limiting: small Redis fixed-window guard (`@RateLimit()`) on login, code send/verify, password reset, link opens, uploads.

Validation: Zod schemas in `packages/shared`, passed to NestJS 12's `@Body/@Query/@Param({ schema })`; unknown fields stripped. Response DTOs mapped explicitly.

## API endpoints (prefix `/api`)

```
POST auth/signup · auth/login · auth/login/verify · auth/refresh · auth/logout
POST auth/password/forgot · auth/password/reset · GET auth/me
GET  invites/:token  · POST invites/:token/accept                      (public)
GET/PATCH w/:wid/settings                                               (Owner/Admin)
GET  w/:wid/members · PATCH/DELETE w/:wid/members/:id · POST w/:wid/invites (Owner/Admin)
GET/POST w/:wid/templates · GET/PUT/DELETE w/:wid/templates/:id          (write: Owner/Admin)
GET w/:wid/dashboard · GET/POST w/:wid/requests · GET/PATCH/DELETE w/:wid/requests/:id
PUT  w/:wid/requests/:id/items · POST w/:wid/requests/:id/send|remind|cancel|export
POST w/:wid/requests/:id/items/:itemId/accept|reject
GET  w/:wid/files/:fileId (stream, audited; Content-Disposition, nosniff, sandboxed CSP)
POST w/:wid/requests/:id/export · GET w/:wid/exports/:id · GET w/:wid/exports/:id/download
GET  w/:wid/audit                                                       (Owner/Admin)
POST client/open · client/code · client/verify                          (public, rate-limited)
GET  client/request · POST client/items/:itemId/files · DELETE client/files/:id (client session)
GET  demo/mail · POST demo/login                                        (public, DEMO_MODE only)
```

## Design system (`apps/web`, PRD §5)

Defined once as Tailwind theme tokens in `app/globals.css`; shadcn/ui components read only these tokens, never raw colours.

| Token | Value | Use |
|---|---|---|
| `ink` / `foreground` | `#0F1E3A` deep navy | text, headings, auth panel |
| `brand` / `primary` | `#D63D14` red-orange (4.6:1 with white) | primary buttons, links, focus ring, highlights |
| `brand-soft` | `#FDEDE7` | icon tiles, active nav |
| `brand-bright` | `#FF7A50` | accent on navy backgrounds |
| `paper` / `background` | `#F5F7FA` cool neutral | page background (cards are white) |
| `border` | `#E2E6EE` | hairlines, inputs |
| `muted-foreground` | `#5A6478` slate | secondary text |
| status | green / amber / crimson / blue / slate | status badges: Complete / Overdue / Rejected / In progress / Draft; green also marks "encrypted" notes |

- **Type:** Public Sans (OFL) via `next/font`, one family. Scale 13 / 14 / 16 / 20 / 24 / 32 / 44 px; tabular numbers for counts and codes.
- **Shape:** radius 8 px controls, 12 px cards, 16 px panels. Shadows neutral grey only, buttons flat.
- **Logo:** SVG mark (navy document with a folded corner and a red-orange tick) + "DocRequest" wordmark in `components/logo.tsx`; same mark as `app/icon.svg`.
- **Patterns:** every list has an empty state with a next action; loading uses skeletons, never spinners; errors say what happened and how to fix it.

## Pages (`apps/web`, shadcn/ui; `/api/*` proxied to the API so cookies stay first-party)

Public: `/` landing page (hero with interactive product tour, comparison, file security walkthrough, template explorer, self-hosting, FAQ, footer).
Staff: `/login`, `/login/code`, `/signup`, `/forgot-password`, `/reset-password`, `/invite/[token]`, `/app` (requests dashboard: status filter, search), `/app/requests/new`, `/app/requests/[id]` (items, previews, accept/reject, zip, remind), `/app/templates`, `/app/templates/[id]`, `/app/team`, `/app/settings`, `/app/audit`.
Client (mobile-first, WCAG 2.2 AA): `/r/[token]` → code entry → checklist with camera/file upload per item, progress bar, rejection reasons. Demo: banner on all pages, `/demo/mail`.

## Phases

**Phase 1 — Foundations, auth, workspaces, roles.** ✅ Done. pnpm + Turborepo monorepo, strict TS, ESLint/Prettier, GitHub Actions CI, dev `docker-compose` (Postgres, Redis). Prisma: User, Workspace, Membership, Invite, RefreshToken, AuditLog. Auth flow with email code, refresh rotation + reuse detection, password reset, global guards, rate limiter, mail queue + worker, team/invite/settings. Web: auth pages, app shell, team, settings.
Tests: login + code + refresh/reuse, role rules, workspace isolation, rate limits.

**Phase 1b — Design foundation.** ✅ Done. Theme tokens, Public Sans, logo + icon, themed shadcn/ui components. Restyled to the design system: split sign-in layout (login, code, signup, forgot/reset password, invite) with a product preview panel, app shell (sidebar on desktop, slide-in menu on phones), team, settings, requests empty state. Copy rewritten in plain UK English.

**Phase 1c — Landing page.** ✅ Done (brought forward from Phase 6 at the owner's request). Brand accent changed to red-orange. Landing page at `/` per PRD §5, built to explain the product by showing it: an interactive 6-step product tour (staff view and client phone in sync), a "follow one file" security walkthrough (type check, ClamAV, EXIF removal, AES-256-GCM, storage, deletion), a template explorer for the 5 built-in checklists, an email vs hosted vs DocRequest comparison, an install terminal and an FAQ. Display font Schibsted Grotesk (OFL) for headings. The template items shown there are the source for the Phase 2 seed. Phase 6 still owns the real `docker-compose.yml` the self-host section points to, and the live demo the buttons link to.

**Phase 2 — Templates and requests.** ✅ Done. Built-in templates live in code (`docs/decisions/003`); workspace templates in the database. Template/Request models, 5 built-in templates, create/edit/send request, secure link (32 random bytes, SHA-256 hash, expiry), request email, dashboard to PRD §5: stat cards (open, waiting for review, overdue, completed this week), "Needs your attention" list, request rows with progress bars ("3 of 5 documents") and colour-coded status badges, recent activity feed (from the audit log, no client details), empty states and skeletons.
Tests: isolation + roles on templates/requests, link stored only as hash.

**Phase 3 — Client upload and secure storage.** ✅ Done. Pipeline: type check by content → encrypt → store → worker scans (ClamAV, or SKIPPED when off) → converts images (HEIC to JPEG, max 2400 px, re-encode drops EXIF/GPS) → re-encrypts under a new key. Corrupt files are sent back to the client after 3 tries. The Next.js `/api` proxy buffers bodies (10 MB default), so `proxyClientMaxBodySize` follows `MAX_UPLOAD_MB`; a 15 MB upload is tested end to end. Client link → code → session, storage adapter (local/S3), AES-256-GCM per-file key wrapped by master key (env or KMS), magic-byte type check, size limit, scan + convert jobs (scan switchable by `CLAMAV_ENABLED`), client upload UI to PRD §5: business name and logo, friendly intro, checklist with big upload buttons, progress bar, kind rejection reasons, "Your files are encrypted" note, "All done" screen.
Tests: link/code security (expiry, wrong code, attempts, session scoped to one request), encryption round-trip, wrong-key fails.

**Phase 4 — Review and download.** ✅ Done. Retakes delete the rejected files and email the reason with a fresh link (links are stored only as hashes, so every email that needs a link carries a new one and older links stop working). PDFs open in a new tab with a strict CSP but no sandbox (browser PDF viewers break under it); images are sandboxed. Zips are built by the worker, encrypted, and deleted after 1 hour. Preview through API (only `CLEAN`/`SKIPPED` files), accept/reject with reason, completion rule, zip export job with clean names (`smith-jane_passport.pdf`), audit entries + audit page.
Tests: file access permissions and isolation, infected or unscanned files never previewable/downloadable, exports respect workspace isolation, completion rule, audit rows never contain client names, emails or file names.

**Phase 5 — Reminders, expiry, retention.** ✅ Done. BullMQ job schedulers (Europe/London): reminders hourly at :05, expiry hourly at :35, retention daily at 03:15. `Reminder` rows with a unique (requestId, kind) key make double sends impossible. Hourly reminder sweep (workspace schedule + before-due, stop on complete, idempotent), manual remind, daily expiry + retention deletion: files deleted, `clientName`/`clientEmail` anonymised, request row kept for counts only, audited.
Tests: reminder scheduling, retention deletion, retention anonymises client details.

**Phase 6 — Demo mode and self-hosting.** ✅ Done. README per PRD §6 with a demo GIF made from real screenshots. Demo ✅: seed (`pnpm db:seed` or first worker start), one-click sign-in, banner, demo outbox at `/demo/mail` (mail kept in Redis), 2 MB uploads, hourly purge of visitor uploads, nightly reset that refuses to run if any non-demo workspace exists. Docker ✅: `docker-compose.yml` (web, api, worker, postgres, redis, clamav as a profile, one-shot migrate), multi-stage Dockerfiles running as non-root, `scripts/init-env.sh` for secrets; CI builds the images and starts the stack. AWS ✅: `infra/aws` Terraform (private S3 with KMS encryption and TLS-only policy, KMS key with rotation, private encrypted RDS PostgreSQL 18 with its password in Secrets Manager, one ARM EC2 with least-privilege role, IMDSv2, no SSH, Caddy for HTTPS), `teardown.sh`; CI runs fmt and validate. Demo seed with realistic fake businesses, client names and real-looking fake documents, banner, one-click demo login, signup off, read-only settings/team, mail viewer, 2 MB limit, hourly purge, nightly reset. Dockerfiles + full `docker-compose.yml` (web, api, worker, postgres, redis, clamav). `infra/aws` Terraform (S3, KMS, RDS, small EC2) + teardown. README per PRD §6, `ASSUMPTIONS.md`, `docs/decisions/`.

Each phase ends with: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, security sweep, `pnpm audit`, then marked done here.

## Libraries (approved)

`argon2` (passwords) · `@nestjs/jwt` (access tokens) · `nodemailer` (email) · `file-type` (content type check) · `sharp` (resize) · `heic-convert` (HEIC→JPEG; sharp's prebuilt binaries don't decode HEIC) · `archiver` (zip) · `@aws-sdk/client-s3`, `@aws-sdk/client-kms` (optional drivers) · `cookie-parser` and `helmet` (skipped if NestJS 12.1 built-ins cover cookies and headers).

## Assumptions (approved)

1. **Signup:** open signup creates a workspace + Owner; self-hosters can switch it off with `SIGNUP_ENABLED=false`.
2. **Password reset** is included (not in PRD, but the project rules rule 4 expects it).
3. One user can belong to several workspaces; workspace is chosen in the UI.
4. Default link expiry 30 days after sending (or 7 days after due date, whichever is later).
5. This container has Node 22, not 24. I'll target Node 24 (`engines`, Dockerfiles, CI) and run locally on 22.
