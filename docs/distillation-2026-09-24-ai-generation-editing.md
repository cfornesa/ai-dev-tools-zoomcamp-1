# AI generation and editing distillation — 2026-09-24

Owner intent: generate every piece type and complex scene that augment-humankind
(and augment-humankind-react-node) can; layer-by-layer, object-specific, or
overall editing chosen by the prompt; `@`-contextualised layers/assets; existing
layers preserved unless the user explicitly deletes them; all vendors, as many
models as possible. Distillation only (owner instruction 2026-09-24); no product
code changed. New issues only; closed #158, #222, #661, #662, #656, #553, #523,
#610, #698, #784 are referenced, not reopened.

## Already covered (no new issue)
- `@` typeahead for structured 2D/3D: #661, #662. Unreferenced-element guard: #158/#222.
- Plan with success criteria: #656. Vendor-aware preferences and catalog: #553, #523.
- Six-engine fake-provider coverage: #698; art engines in editors: #610.

## Gaps found and new issues (dependency order)
| Order | Issue | Gap | Route |
| --- | --- | --- | --- |
| 1 | #809 | Gemini/DeepSeek use short generic 2D prompts, not Mistral's detailed ones | 2b |
| 2 | #810 | Same for 3D incl. drawing-plane/animation vocabulary (0 refs in Gemini) | 2b (after #809) |
| 3 | #811 | `art_piece_provider.py` is Mistral-only | 2b |
| 4 | #816 | No structured-output extraction/repair for models lacking schema mode | 2b |
| 5 | #812 | Referenced elements can still be removed without delete intent | 2b |
| 6 | #813 | Plan-declared scope not enforced at apply time | 2b |
| 7 | #814 | Owner decision: what `@` addresses in generated code pieces | decision |
| 8 | #815 | No offline corpus/layer-preservation regression tests | 2a |

## Blockers / boundaries
- #814 needs an owner answer (recommended default recorded in the issue); its implementation issues are distilled after.
- #816 may need one additive catalog column; the issue says to split that into its own issue first.
- Live-vendor quality is a verification boundary; #815 keeps live mode opt-in.
