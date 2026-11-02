# 003: Built-in templates live in code

**Decision.** The five ready-made checklists are a constant (`BUILTIN_TEMPLATES` in `packages/shared`), not database rows. Workspace templates are rows in `Template` / `TemplateItem`. "Make a copy" turns a built-in into a workspace template.

**Why.**
- Nothing to seed: built-ins exist on a fresh install, after a test reset and in the demo without a seed step that can drift or be forgotten.
- One source of truth: the API, the app and the landing page's template explorer all read the same constant, so the marketing page can't promise a checklist the product doesn't have.
- Built-ins are read-only anyway, so the database adds nothing but a sync problem.

**Trade-off.** Changing a built-in needs a release, not an admin screen. That is intended: workspaces edit their own copies.

Requests copy items at creation time, so editing or deleting a template never changes requests already sent.
