# Issue 614 — Canonical six-engine art-piece capability contract

## Goal

At the art-piece API and type boundary, represent the six requested engines
without silently coercing or accepting an engine that another surface cannot
identify. Preserve the existing persisted identifiers and add `p5js`, `c2js`,
and `c2js-interactive`; expose human-facing labels separately.

## Scope and precondition

Entry point: the generated art-piece API/provider/frontend type boundary.
Precondition: run against the repository's test settings and disposable
SQLite test database; no Replit, production, or shared database writes.

The identifier decision is additive and compatibility-preserving:

| Stable ID | Display label | Family |
| --- | --- | --- |
| `canvas2d` | Canvas 2D | 2D |
| `svg` | SVG | 2D |
| `p5js` | p5.js | 2D |
| `c2js` | C2.js | 2D |
| `c2js-interactive` | C2.js Interactive | 2D |
| `threejs` | Three.js | 3D |
| `aframe` | A-Frame | 3D |

The six requested engines are p5.js, C2.js, C2.js Interactive, SVG, Three.js,
and A-Frame. `canvas2d` remains a backward-compatible local engine because it
already exists in persisted rows and APIs; the capability registry therefore
contains seven stable IDs while the requested parity set remains six.

## Acceptance criteria

- [ ] `ArtPiece.Engine`, API serializers/validators, provider library allowlists,
      and frontend `ArtPieceLibrary` agree on the seven stable IDs above;
      unknown IDs are rejected and existing four-engine rows continue to load.
- [ ] One canonical capability registry exposes, for every stable ID, its
      display label, 2D/3D family, regular-view support, immersive support,
      embed support, download support, and editor target; unsupported
      capability values are explicit false values rather than inferred from
      the label.
- [ ] API responses expose the stable engine ID and display label separately;
      no route derives a URL segment or runtime choice from the display label.
- [ ] Provider validation and prompts accept the three new IDs only through
      the registry; they do not claim runtime support that is not yet
      implemented. The registry marks the new runtimes as unavailable until
      the dependent runtime/editor/download issues complete.
- [ ] A migration or equivalent schema change is additive and reversible,
      preserves existing rows, and has a test proving `makemigrations
      --check --dry-run` is clean after applying it.
- [ ] Focused tests cover each seven-ID row, unknown-ID rejection, API
      serialization, provider allowlisting, and frontend type/registry parity.

## Verification

Focused:

```sh
cd backend && DJANGO_SETTINGS_MODULE=backend.test_settings uv run pytest tests/test_art_piece_persistence.py tests/test_art_piece_api.py tests/test_art_piece_provider.py
cd backend && DJANGO_SETTINGS_MODULE=backend.test_settings uv run python manage.py makemigrations --check --dry-run
cd frontend && npm test -- --run src/api/artPieceEngines.test.ts src/pages/ArtPieceStudio.test.tsx
```

Full:

```sh
make check
```

The issue is locally closable only with automated evidence. Replit schema
publication and live six-engine rendering are release gates owned by the
dependent issues and are not acceptance criteria here.

## Out of scope and dependencies

- Regular/embed rendering and extracted runtime behavior: #607.
- Full-screen immersive rendering: #608 (using the route shell from #606).
- Offline regular/immersive bundles: #609.
- 2D/3D AI-editor integration: #610.
- Physical pieces/collections schema parity beyond this engine contract: #613.
- Sanitized @cfornesa reference import: #612.

## Routing hint

Stage 2b complex — this changes a persisted enum/API contract, provider
business rules, and migration/test behavior. It must be reviewed as a
schema/business-logic change before any runtime consumer proceeds.

## Evidence boundary

Local automated checks prove the contract and migration safety only. They do
not prove that a new engine renders, embeds, downloads, or is live in Replit.
