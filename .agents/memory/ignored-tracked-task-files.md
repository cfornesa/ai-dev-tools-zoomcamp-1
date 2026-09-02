---
name: Ignored tracked task files
description: Resolving merge conflicts for tracked task records under ignored workspace directories
---

Tracked task records can live under an ignored workspace directory. When an incoming branch restores or modifies one after the local branch deleted it, ordinary `git add` may refuse the resolved file even though it is the intended merge result; force-stage only that known path.

**Why:** A modify/delete conflict in an ignored tracked path can leave the repository unable to complete the merge, while broad force-staging risks adding unrelated workspace files.

**How to apply:** Inspect the conflict path first, choose the required side explicitly, then use `git add -f` for that exact path and ordinary `git add` for the remaining tracked source changes.