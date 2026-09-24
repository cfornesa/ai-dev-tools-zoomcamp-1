# Backlog session 2026-09-24 (this repo only; react-node owned by another agent)

Orchestrator: backlog-session / Claude Sonnet 5 (default profile) / not substituted.
Stage provenance default for this session (flagged per issue as run): scoping = Claude Sonnet 5 (substituted for Codex, at distillation); implementation = Claude Sonnet 5 (substituted for Opencode Go/Ollama Cloud); second-opinion (stage 3) = NOT RUN (no independent family); QA = Claude Sonnet 5 Medium (rostered); readiness gate = Claude (rostered tier) at session end.

## Ledger
| Issue | Status | Commit | Focused/full checks | QA | GitHub | Boundary |
|---|---|---|---|---|---|---|
| #765 | CLOSED | 145fbce | prettier check on doc | PASS (doc criteria; cross-repo posting shifted out of scope) | closed | doc only |
| #761 | CLOSED | a8a9ede | vitest export 192; make frontend-* 2826 tests; playwright exportArtifacts 10 | PASS | closed | local only; deployed under #748 |
| #762 | CLOSED | 43a014f | make check pass | PASS | closed | local; deploy under #748 |
| #763 | CLOSED | e73fb6a | make check; piece2dFill compose | PASS | closed | local; prod data #788 |
| #764 | CLOSED | 26cdf02 | vitest generative; playwright c2ZipCanvas764 | PASS | closed | local |
| #752 | CLOSED | 19e6b9f | vitest 284; playwright embedToolbarOrder, sixEngineEmbed, publicDraw | PASS | closed | local |
| #753 | CLOSED | 4a08d02 | vitest; playwright immersiveArtPieceToolset | PASS | closed | local |
| #754 | CLOSED | ae9769e | playwright immersiveEmbedFraming, embedToolbarOrder, sixEngineImmersive | PASS | closed | local; real-camera under #748 |
| #766 | CLOSED | d98bb13 | vitest 141; playwright regularToolbarMatrix + toolset specs | PASS | closed | local |
| #767 | CLOSED | 511ae34 | vitest 223; playwright regularToolbar3d767, public3dCameraOverlay728 | PASS | closed | local; drift specs to #769 |
| #768 | CLOSED | 65a784a | playwright regularToolbar2d768 | PASS | closed | local |
