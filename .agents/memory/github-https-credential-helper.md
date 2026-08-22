---
name: GitHub HTTPS credential helper
description: How to push safely when a valid GIT_URL secret is not used by the configured Git remote.
---

When GitHub accepts the token embedded in `GIT_URL` through its API but `git push origin main` still reports an invalid username or token, use a one-command Git credential helper that supplies the URL's username and token in memory. Do not print, persist, or replace the remote URL with the secret.

**Why:** The workspace's stored HTTPS remote or credential helper can keep selecting a stale credential even after the user adds a valid `GIT_URL` secret. Repointing or exposing the remote URL is unnecessary and risks leaking the token.

**How to apply:** Validate only the secret's structure and GitHub API status/scopes without exposing it. Then run the push with a temporary credential helper sourced from `GIT_URL`, verify the GitHub branch SHA, and update the local `origin/main` tracking ref only after the verified remote matches local `HEAD`.

Fetch `origin` before diagnosing a rejected push so the comparison uses current remote refs; with the helper active, a normal fetch followed by push preserves history and avoids unnecessary merges or force-pushes.