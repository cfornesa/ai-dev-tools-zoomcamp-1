## Goal

Make the generated-piece sandbox's acknowledged sound telemetry and keyboard
notes faithful to the authored sound contract so the Chrome verification
issues can test real runtime behavior instead of inferring it from controls.

## Acceptance criteria

- The sandbox reports the actual `AudioContext.state` after Sound activation,
  and the parent displays that acknowledged state without claiming `running`
  when resume failed.
- Ambient note events report the emitted note name and frequency, in addition
  to the existing status event, so a real browser trace can verify the first
  eight notes and scale membership.
- Generated keyboard notes map `a s d f g h j k` through the selected root,
  scale, and transpose settings, and report the resolved note name and
  frequency. The default C-major mapping is C4 D4 E4 F4 G4 A4 B4 C5.
- Existing authored defaults, sound controls, ZIP runtime, and non-generated
  structured sound paths remain backward-compatible.
- Add focused sandbox/runtime tests covering AudioContext acknowledgement,
  ambient note reporting, default C-major mapping, and a non-default
  root/scale/transpose mapping.

## Verification

- `cd frontend && npm test -- --run src/pages/ArtPieceStudio.test.tsx src/generative/artPieceSandbox.test.ts`
- `cd frontend && npm run typecheck && npm run lint`
- `UV_CACHE_DIR=/tmp/ai-dev-tools-uv-cache make check`
- Chrome local Compose verification through the existing #853–#861 fixtures:
  Sound activation must expose `running`, eight ambient event notes must be
  captured, and A-K must resolve to the selected keyboard contract.

## Scope and dependencies

In scope: `frontend/src/generative/artPieceSandbox.ts`, its parent runtime
state display in `frontend/src/pages/PieceStageControls.tsx`, and focused tests.
No new dependency, migration, production data action, or upload pipeline.

This issue is a shared prerequisite for #853–#861 and should be processed
before those verification-only transactions. It is distinct from closed #430
(runtime gating) and #832 (broad live/download sound verification).

## Routing hint

Stage 2b complex logic: this changes sandbox runtime semantics, note theory,
and parent/iframe message contracts; stage 4 requires real Chrome evidence.
