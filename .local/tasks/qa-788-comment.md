## QA: BLOCKED — production execution path unavailable

### Safeguard evidence

- Command source inspected: `backend/scenes/management/commands/import_reference_pieces.py` supports `--allow-production`, `--dry-run`, owner/profile resolution by handle, idempotent provenance markers, and immutable new versions when a marked source/capability changes.
- Local disposable rehearsal: `docker compose exec -T backend uv run python manage.py import_reference_pieces import --username cfornesa --handle cfornesa --json` created exactly six marked fixtures (`reference-svg-study`, `reference-p5-study`, `reference-c2-study`, `reference-c2-interactive-study`, `reference-threejs-study`, `reference-aframe-study`). The same command with `--dry-run --json` reported `planned_fixture_count: 6`, `existing_reference_count: 6`, `would_create: 0`, `would_update: []`, `slug_conflicts: []`, and `no_write: true`. Disposable cleanup removed exactly six pieces.
- Production snapshot: `.local/tasks/production-788-before.json`, captured from `https://augmentrart.com/api/public/art-pieces/`, records the two affected C2 public IDs, slugs, engines, version IDs/sequences, and current sources.

### Blocker

The Replit visible Shell is the development workspace and cannot expose the published production database. The checked-in deployment wrapper can invoke the importer inside the published runtime only during startup, but that requires changing deployment environment state and publishing; no interactive production shell or safe post-start command is available in the current Replit session. The owner-authorized production write was therefore not attempted. No production rows were changed.

### Evidence boundary and next action

Local command/test evidence does not close this production criterion. Next action requires the owner-approved Replit production execution path (or a supported one-shot production shell) that can run preview first, record its planned rows, then run the importer once in write mode. If that path is provided, re-read the snapshot immediately before the write, verify both live C2 routes at 1280x900 and 375x812, confirm version history, and verify unrelated pieces are untouched.
