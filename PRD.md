# DocRequest — PRD

**One line:** a free, self-hosted way for businesses to collect documents from their clients securely, instead of chasing them by email.

**Owner:** Toukir Ahmed Rony · **Licence:** AGPL-3.0 · **Repo:** public on GitHub · **Demo:** docrequest.toukirahmedrony.com

## 1. The problem

Accountants, solicitors, recruiters, letting agents and care agencies need documents from their clients: passports, proof of address, payslips, bank statements. Today this happens over email and WhatsApp. It is insecure (passports sitting in inboxes), messy (files arrive with random names, half missing) and slow (staff spend hours chasing). Paid tools such as Content Snare and FileInvite solve this for a monthly fee. DocRequest is the free, open-source, self-hosted alternative, so a business keeps sensitive files on its own server.

## 2. Users

- **Business admin:** sets up the workspace, team, templates and retention rules.
- **Business staff:** creates requests, reviews uploads, downloads files.
- **Client:** a member of the public who receives a link and uploads documents. No account, often on a phone, often not technical.
- **Self-hoster:** a developer who installs DocRequest for a business.

## 3. Features (version 1)

**Workspaces and team**
1. Multi-tenant: each business is a workspace. Every query is scoped to the workspace.
2. Roles: Owner, Admin, Staff. Owner/Admin manage team, templates and settings. Staff create and review requests.
3. Team invite by email. Login with email + password (argon2id) and a 6-digit email code for every login.

**Templates and requests**
4. Checklist templates: a named list of items, each with a title, short help text, required/optional, and allowed file types. Ship ready-made templates: New tenant, New employee (right to work), Self-assessment tax return, Immigration case, Mortgage application.
5. Create a request from a template (or blank), for one client: name, email, optional due date, optional message. Items can be edited per request.
6. The client receives an email with a secure link. Each link is unique, random and long, stored only as a hash, and expires.

**Client upload (mobile first)**
7. The client opens the link and confirms with a 6-digit code sent to their email. No account.
8. The client sees the checklist and uploads one or more files per item: take a photo or choose a file. Progress shows what is done and what is missing.
9. Accepted types: PDF, JPEG, PNG, HEIC (converted to JPEG), up to 20 MB per file (configurable). Large images are resized.
10. The client can come back to the same link until the request is complete or expired.

**Review**
11. Staff open a request, preview each file in the browser, and mark each item Accepted or Rejected with a reason ("photo is blurry, please retake"). Rejected items go back to the client with the reason.
12. A request is Complete when every required item is accepted.
13. Download all accepted files as one zip, with clean file names (e.g. `smith-jane_passport.pdf`).

**Reminders**
14. Automatic reminders to the client for missing or rejected items, on a schedule per workspace (default: 2, 5 and 7 days), and a reminder before the due date. Staff can send one manually. Reminders stop when the request completes.

**Dashboard**
15. List of requests with status: Draft, Sent, In progress, Overdue, Complete, Expired. Filters and search by client name.

**Security and privacy**
16. Every file is encrypted at rest with its own key (AES-256-GCM). File keys are wrapped by a master key (from env locally, from AWS KMS in the AWS deploy). Files are never served directly; downloads go through the API after a permission check.
17. Uploads are virus-scanned (ClamAV) before staff can open them. Scanning is optional for self-hosters but on by default in Docker Compose.
18. Retention: files are deleted automatically a set number of days after a request completes or expires (default 30, per workspace). Deletion is logged.
19. Audit log: who created, viewed, downloaded, accepted, rejected and deleted what, and when. Append-only.
20. Rate limits on login, code requests, link opens and uploads.

**Demo mode**
21. `DEMO_MODE=true`: a seeded demo workspace with sample requests and fake files; a banner "Demo — do not upload real documents"; no real emails sent (written to a local mail folder and shown in the demo); uploads limited to 2 MB and deleted every hour; the whole demo resets nightly.

**Self-hosting**
22. `docker compose up` runs everything: web, API, worker, PostgreSQL, Redis, ClamAV.
23. Storage adapter: local disk (default) or any S3-compatible storage.
24. An AWS deploy guide with Terraform (S3 for files, KMS for the master key, a small EC2 or ECS service, RDS PostgreSQL), plus a teardown command.

## 4. Non-functional

- Mobile-first client pages; must work well on a cheap Android phone on 4G.
- Accessibility: WCAG 2.2 AA on client pages.
- UK English, dates shown in Europe/London.
- No real personal data in seeds, tests, logs or screenshots.

## 5. README must include

What it does (with a short demo GIF), why it exists, run it locally, self-host with Docker, deploy to AWS, how security works (encryption, keys, retention), hard problems and how they were solved, decisions, tests. Plain, simple English, same standard as the Slotwise repo.

## 6. Out of scope for version 1

E-signatures, client accounts, payments, OCR or AI checks on documents, integrations (Xero, Google Drive), white-label custom domains, native mobile apps.

## 7. Done means

- A business can create a request from a template, a client can upload from a phone, staff can review, reject, accept and download a zip, reminders send, and files delete on schedule.
- Tests pass for login, permissions, workspace isolation, link and code security, encryption round-trip, and retention deletion.
- Demo live, `docker compose up` works from a clean machine, README complete.
