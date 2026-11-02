# Assumptions

Decisions made where `PRD.md` is silent. Approved in the planning step unless marked otherwise.

1. **Sign-up** is open by default and creates a new workspace with the person as Owner. Self-hosters can turn it off with `SIGNUP_ENABLED=false`. It is always off in demo mode.
2. **Password reset** is included (email link, valid 1 hour, single use, signs out every session).
3. **Several workspaces per user** are allowed. The workspace is picked in the UI; the API checks membership on every request.
4. **Client links** expire 30 days after sending by default (per-workspace setting), or later if the due date needs it.
5. **Node.js 24** is the target (CI, Docker, `engines`). The cloud build session had Node 22, so local checks there ran on 22.
6. **Login codes** are valid for 10 minutes, 5 tries per code. Wrong passwords and unknown emails get the same message.
7. **Owner** is fixed: nobody can change or remove the Owner. Admins can only manage Staff.
8. **Sessions:** access token 15 minutes, refresh token 30 days, rotated on every use.
9. **Built-in templates** live in code, shared with the landing page (`docs/decisions/003`).
10. **Client links rotate** with every email that carries one; older links stop working (`docs/decisions/004`).
11. **Retakes delete the rejected file** straight away rather than keeping it until retention.
12. **Reminders** list only required documents that are missing or need a retake, go out between 08:00 and 20:00 UK time, and a late sweep sends one email rather than a backlog. Staff can send one manual reminder an hour.
13. **PDF previews** open in a new tab with a strict Content-Security-Policy but no `sandbox`, because browsers' built-in PDF viewers stop working under one. Images are sandboxed. Only content-checked PDFs and re-encoded JPEG/PNG are ever served.
14. **Retention** deletes files and also wipes their wrapped keys (crypto-shredding), and replaces the client's name with "Deleted client"; email, message and retake reasons are cleared.
15. **Upload size** is limited in two places that must agree: the API (`MAX_UPLOAD_MB`) and the Next.js proxy, which is configured from the same variable.
