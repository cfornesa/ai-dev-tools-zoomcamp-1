---
name: feature-branches-completed-work-not-merged-to-main
description: tasks.md/GitHub can report an issue COMPLETE and closed while its code only exists on a feature branch that was never merged or opened as a PR against main -- verify the branch is actually in main's history before building on top of "complete" work.
metadata:
  type: project
---

Issues #210-213 (the 3D scene editor backend: schema, validators, Django
models, creation/retrieval API) were documented in `_docs/tasks.md` as
`Status: COMPLETE` with closed GitHub issues, each entry saying "Delivered
on the `3d-scene-editor-epic` branch (commit ...)". No PR was ever opened
for that branch and it was never merged into `main` -- `git log
main..3d-scene-editor-epic` showed 5 unmerged commits, and files like
`schema/scene3d.schema.json`, `scenes/validation3d.py` simply did not
exist on `main` (only stale compiled `.pyc` files hinted anything had
existed at some point).

**Why:** The agent session that did that work apparently ran on the
feature branch, wrote its "COMPLETE"/closed status narrative into
`tasks.md` on that same branch, and either never merged back to `main` or
assumed a merge would happen separately. Nothing in the completion
checklist verified the work actually reached `main`. This was only caught
because every dependent open issue (#226-233, #230 -- the four-editor
epic, [[four-editor-product-line-epic]]) needed the 3D backend to exist
and it silently didn't, on the branch actually being worked from.

**How to apply:** Before starting implementation on any issue whose
acceptance criteria assume prior "COMPLETE" work exists, confirm the
files/code it depends on are actually present in the current branch's
working tree -- don't trust `tasks.md`'s or a closed GitHub issue's status
alone. If a gap like this is found, treat it as a blocking process defect:
merge (or otherwise land) the missing work into the base branch first,
resolving any `tasks.md` narrative conflicts in favor of the base
branch's already-current text, and rerun the full `make check` suite
before proceeding. Also check `git branch -a` / `gh pr list` periodically
during multi-session backlog work for other stale unmerged branches this
pattern might apply to (as of 2026-08-29: `creatrweb-animate-sync`,
`feature/multi-library-ai-art-generation`, `local-render-test` were all
already merged via PRs #96/#102/#105/#107/#201 -- only
`3d-scene-editor-epic` was orphaned).
