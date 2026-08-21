---
name: Vitest shell file paths
description: How frontend Vitest tests should load static files from the application shell
---

Frontend Vitest transforms `import.meta.url` into a non-file URL in this project, so Node's URL-based file reads fail. Use the frontend process root (`process.cwd()`) when a test needs to inspect a static shell file.

**Why:** A document-level shell assertion needs to inspect the actual `index.html`, while the transformed test URL cannot be passed to `readFileSync`.

**How to apply:** Resolve static frontend files from `process.cwd()` in Vitest tests, assuming they run through the frontend package scripts.