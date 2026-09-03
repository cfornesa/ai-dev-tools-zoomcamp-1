---
name: Published-app checkpoint commits
description: How to handle Replit-generated publication commits during Git synchronization
---

Treat a `Published your App` commit as a disposable checkpoint unless its diff contains meaningful source, test, configuration, or documentation changes. During reconciliation, preserve its parent and incoming meaningful commits, and keep the checkpoint only on a backup ref if rollback provenance is useful.

**Why:** Replit can create publication checkpoints that make `main` appear to diverge from GitHub and trigger repeated sync errors even when the checkpoint adds no product work.

**How to apply:** Inspect the checkpoint diff before deciding. If it is checkpoint-only, create a backup ref, reset or fast-forward `main` to the meaningful incoming tip, and avoid force-pushing.