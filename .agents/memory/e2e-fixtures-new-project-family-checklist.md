---
name: e2e-fixtures-new-project-family-checklist
description: Adding a new Project-like model (a PROTECT current_version FK, a soft-delete manager, or fixture-owned rows) needs matching updates in e2e_fixtures.py cleanup and any locator that assumes one project-grid.
metadata:
  type: feedback
---

Two latent defects surfaced only once `frontend/e2e/project3dLifecycle.spec.ts`
(#239) became the first spec to give an `e2e_owner`-fixture-owned
`Project3D` row, and once #242 gave `Project3D` a soft-delete manager pair:

1. `scenes/management/commands/e2e_fixtures.py`'s `_cleanup` deletes fixture
   `User` rows and relies on `CASCADE` to remove everything they own. Any
   sibling model to `Project` whose own "current version" FK is
   `on_delete=PROTECT` (as `Project.current_version` and
   `Project3D.current_version` both are) must be explicitly nulled for the
   fixture owners *before* that delete, in the same way `Project.all_objects`
   already was — otherwise the first spec that ever creates such a row for a
   fixture user breaks `_cleanup` with `ProtectedError`, and every E2E run
   after it (not just the offending spec) fails teardown. Once that model
   gains its own soft-delete manager, use its `all_objects` manager here too
   (not the filtered default), so a soft-deleted fixture row still gets
   nulled.
2. Any Playwright locator scoped by a CSS class shared across project
   families (e.g. `.project-grid`, `.project-card` — both `ProjectCard.tsx`
   and `Project3DCard.tsx` use `.project-card`) breaks in Playwright's strict
   mode the moment a fixture owner has more than one family's project at
   once. `frontend/e2e/responsiveShell.spec.ts`'s populated-gallery test hit
   this the first time a fixture owner had both a 2D and a 3D project in the
   same run. `.first()` disambiguates only if DOM order between families is
   fixed and known (2D renders before 3D in `Gallery.tsx`) — a more specific
   selector is safer if that ordering isn't guaranteed to stay fixed.

**Why:** neither defect was visible until a real spec exercised the
previously-uncovered path — `make e2e` was green for the entire lifetime of
`Project3D` (#213 onward) only because nothing had ever created one for
`e2e_owner`/`e2e_other` before #239.

**How to apply:** when adding a new `Project`-like model (its own
`current_version`-style PROTECT FK, its own soft-delete manager, or fixture
users that will own it), check `e2e_fixtures.py`'s `_cleanup` and grep
`frontend/e2e/` for any class-based locator that assumes only one project
family exists, before merging the first E2E spec that actually creates rows
of the new model for a fixture user.
