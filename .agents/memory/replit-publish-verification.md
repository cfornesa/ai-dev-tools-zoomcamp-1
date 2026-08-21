---
name: Replit publish verification
description: How to run anonymous checks after a published deployment
---

Replit deployment configuration provides build and run lifecycle commands, but
not a post-publish command hook that can reach the newly published URL. Use a
GitHub deployment-status trigger for checks that must run after publishing.

**Why:** The published endpoint is only available after the deployment succeeds,
so running the probe as part of the deployment build or startup is too early and
can create a circular health check.

**How to apply:** Keep post-publish probes anonymous, take the URL from the
successful deployment event, and retain a repository URL variable only for
manual or ordinary CI verification.