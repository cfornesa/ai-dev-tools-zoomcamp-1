---
name: Account settings production audit 2026-09-15
description: Live-Chrome findings against https://augmentrart.com/account/settings — a real entitlements 500 and a flat-column layout gap, both filed as new issues.
metadata:
  type: project
---

Authenticated Claude-in-Chrome inspection of the real production deployment
at `https://augmentrart.com/account/settings` on 2026-09-15 found two
genuine gaps not covered by any existing open issue:

1. `GET /api/account/entitlements/` returns HTTP 500 in production while
   every other account API on the same page (`whoami`, `profile`,
   `provider-credentials`, `mistral-model-preferences`, `ai-personas`,
   `ai-retry-preference`, `site-theme`) returns 200. This is why the page
   permanently shows "Could not load your plan and usage." with a
   non-functional Retry button. Root cause unconfirmed locally (code review
   of `scenes/entitlements.py`/`scenes/account_entitlements.py` found no
   obvious exception in the happy path); needs real Replit production logs.
   Filed as [#547](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/547).

2. The page itself is one long undifferentiated column: profile, 6 stacked
   account-management links (including "Delete your account" styled
   identically to "Manage billing"), 3 AI provider credential forms, saved
   Mistral models, Personas, and automatic-retry preferences all run
   together with no section/card grouping. The accessibility tree is
   actually well-formed (correct landmarks, skip link, label/for
   associations, headings) — this is a visual/grouping gap (WCAG 2.2 SC
   1.3.1) and a usability gap, not a broken-semantics gap. Filed as
   [#548](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/548).

**Why:** the owner reported the page as "completely disorganized" and asked
whether the admin panel was even built. The admin panel (`/admin/settings`,
`/admin/pages`, `/admin/content`) does exist and does have site theme
customization (#521, closed) — confirmed via source (`frontend/src/pages/AdminSettings.tsx`)
since the current session's non-admin account can't reach it live
(fail-closed admin boundary redirects to `/`, expected behavior, see
[[cross-repo-parity-inventory]]). #521 deliberately scoped out arbitrary
custom CSS/HTML/JS site theming (unlike `augment-humankind-react-node`'s
sandboxed custom-runtime theme system) as a security boundary — that is an
intentional decision, not a gap, and was not re-opened or re-filed.

**How to apply:** #547 and #548 are independent (different surfaces of the
same page) and can proceed in parallel; neither blocks the other. Do not
re-file richer CSS/HTML/JS site theming without a fresh explicit owner
decision to reopen that security boundary — see the #521 closure record in
`docs/tasks.md`.
