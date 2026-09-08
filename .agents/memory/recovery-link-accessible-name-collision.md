---
name: recovery-link-accessible-name-collision
description: A page-local nav rendered inside persistent shell chrome must give its links distinct accessible names from the shell's own nav, or real-browser role queries hit ambiguous duplicates.
metadata:
  type: project
---

`Layout`'s primary site nav (`frontend/src/components/Layout.tsx`) renders
unconditionally at desktop widths with `aria-label="Primary navigation"` and
bare "Home"/"Public gallery" links. On mobile it collapses that same nav
behind a hamburger toggle via `hidden={!menuOpen}`, which removes it from the
accessibility tree until opened.

Any page rendered inside `Layout` that adds its own "Home"/"Public gallery"
(or similarly generic) links — a not-found view, an error state, an empty
state — will duplicate the shell nav's accessible names at desktop widths,
where both are simultaneously visible. `getByRole('link', { name: 'Home' })`
then resolves to two elements and fails Playwright's strict mode. A unit test
that scopes its queries with `within(recoveryNav)` will not catch this,
because scoping is exactly what hides the duplication.

**Why:** discovered in issue #485 (accessible not-found view) — QA's first
pass was a real Chromium browser run, not the unit suite, and only that run
reproduced the collision. The mobile scenario passed even with the defect
present, because the primary nav happens to be collapsed by default there.

**How to apply:** any new page-local navigation nested inside `Layout` must
use link text distinct from the shell nav's own link text (the fix used
"Return to the home page" / "Browse the public gallery" instead of bare
"Home"/"Public gallery"), or must not duplicate the shell's role/label at all.
Do not rely on a scoped unit-test query to prove this is safe — verify with an
unscoped, real-browser role query at the desktop viewport where the shell nav
is always visible. See [[full-browser-readiness-gate]] for the broader point
that a real browser run is required evidence, not a formality, for this class
of UI change.
