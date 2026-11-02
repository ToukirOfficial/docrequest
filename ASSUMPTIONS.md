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
