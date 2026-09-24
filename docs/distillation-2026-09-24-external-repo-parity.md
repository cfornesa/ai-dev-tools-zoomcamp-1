# External-repo parity distillation — 2026-09-24

Source of truth (read-only): `/Users/Fornesus/Code/augment-humankind-react-node`.
Only new issues were added; no closed issue was edited or reopened. Existing
related closed issues referenced: #639, #647, #642, #643, #274, #334, #335,
#637, #638. Open owner/Codex-gated: #747, #748, #788.

## Manifest and dependency order (routing hint in brackets)

| Order | Issue | Scope | Depends on |
| --- | --- | --- | --- |
| 1 | #807 | Animated Celestial star field for cosmic backdrop [2a] | none — next groomed issue |
| 2 | #798 | Star field reduced-motion/low-power/theme tokens [2a] | #807 |
| 3 | #801 | Runtime error/ready template, all six engines [2b] | none |
| 4 | #799 | 2D template control parity online + ZIP [2b] | #801 |
| 5 | #800 | 3D template control parity online + ZIP [2b] | #801 |
| 6 | #802 | 2D regular/immersive/embed identity [2a] | #799 |
| 7 | #803 | 3D regular/immersive/embed identity [2a] | #800 |
| 8 | #804 | Collections parity matrix [2a] | none |
| 9 | #805 | Profiles/personalization parity matrix [2a] | none |
| 10 | #806 | Published verification on Replit [verification] | all above + #747/#748/#788 |

## Duplicate / already-covered report

- Toolbar/control parity for the previous batch: #274 family, `docs/piece-toolbar-parity-matrix.md`.
- Collection regular/immersive/embed: #639, #566, #568, #641 — #804 is a matrix audit, not a re-do.
- Profile/site style contracts: #642, #643, #551, #571 — #805 audits vs the external form.
- Star field: no existing issue; only the static `cosmic` gradient exists (#521 tokens).

## Blockers

- #806 is dependency-blocked (verification-boundary): needs the owner/Codex Publish.
- Stars source is the external repo's legacy PHP seed, not the React app; implemented first-party (no theme JS, no dependency).
