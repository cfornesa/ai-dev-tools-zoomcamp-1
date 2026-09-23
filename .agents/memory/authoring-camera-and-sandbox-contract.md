# Authoring camera and sandbox contract

## 2026-09-23 — Confirmed authoring/runtime decisions

- Persist camera placement as a nullable `ArtPieceVersion.camera_placement`
  field with values `overlay` or `background`. Validate and project it through
  the API, viewers, and exports; use an additive reversible migration. A
  `NULL` value preserves the legacy overlay behavior.
- Generated preview source remains in an opaque `iframe sandbox="allow-scripts"`
  with strict injected CSP. Do not add `allow-same-origin` merely to imitate
  the PHP reference: generated source does not need the app origin, and
  granting it could expose cookies, storage, or credentialed APIs. Keep camera
  and hand-tracking permissions in the trusted parent runtime behind the
  versioned, allowlisted message bridge.
- Treat synthetic camera evidence as runtime-contract evidence only; real
  camera/production behavior still requires stronger verification when the
  issue concerns liveness or performance.
