---
name: Live published audit follow-ups
description: The 2026-09-17 published AugmentrART audit separated healthy frontend asset delivery from production schema/data drift and identified linked UI follow-ups.
---

On 2026-09-17, the published site loaded its hashed JavaScript and CSS assets
successfully (HTTP 200, correct MIME types), so a global bundle-delivery failure
was not the cause of the loading screens. The production API still returned
500 for project lists, public gallery/projects, the Christopher public profile,
admin content, and admin settings.

Read-only Replit production inspection found `scenes_project.seo_config` and
`scenes_project3d.seo_config` absent while the source migration `0078` adds
them, and found `scenes_sitesettings.metadata_tags` stored as `NULL` even
though the backend sanitizer requires a list. This is tracked by #589; do not
run blanket `manage.py migrate` against Replit production because the database
and Django migration ledger can diverge. Use the approved Replit schema/publish
workflow and direct table/row verification.

The published `/llms.txt` and `/llms-full.txt` paths returned the React HTML
shell as `text/html` even though Django routes exist; serving/proxy behavior is
tracked by #590. Owner-reported UI contradictions after closed #554/#574,
#575/#584, and #583 were preserved as new follow-ups #591-#594 rather than
reopening historical issues. The backlog record is `docs/tasks.md` under the
2026-09-17 live published audit entry.
