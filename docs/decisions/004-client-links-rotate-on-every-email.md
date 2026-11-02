# 004: Client links rotate on every email

**Decision.** Only the SHA-256 hash of a client link is stored (PRD §3, item 6). So the server can't put an existing link into a later email. Every email that needs a link (first send, "send a new link", retake requests, reminders) makes a fresh random link, and older links stop working.

**Why.** Keeping the raw token (even encrypted) would let anyone with the database and the master key open a client's upload page. With hashes only, a database leak exposes no working links.

**Effect for clients.** The newest email always works. An old email shows "This link isn't valid. Check you opened the latest email, or ask for a new link." A client who is already signed in on the page stays signed in: sessions are separate from links (bound to one request, 2 hours, renewed while active).

**Expiry** is set when the request is first sent (or re-sent by staff) and is not extended by reminders or retakes.
