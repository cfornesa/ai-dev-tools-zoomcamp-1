# Chrome workflow-validity distillation — 2026-09-25

Owner request: have Codex, using the active Chrome session, create a reasonably
complex serene scene (major scale, ~90 BPM default; creator-specifiable BPM/scale
defaults for ambient and piano keyboard) for p5.js, C2.js, C2.js interactive, SVG,
A-Frame and Three.js, **to gauge the validity of the workflow for each rendering
engine**. Distillation only; no product code changed. Codex's #832 audio work is
untouched; all issues below are blocked on it and on the sound issues #833-#851.

## Gap found
#844 (authored defaults) covers BPM/scale/instrument/volume/filter/oscillator/
envelope but not separate ambient vs keyboard scopes or keyboard key/scale/
transposition. New issue #852 makes this explicit (not an edit of #844).

## Manifest
| Order | Issue | Scope | Executor |
| --- | --- | --- | --- |
| 1 | #852 | Authored defaults: separate Ambient / Keyboard groups | 2b (implementation) |
| 2-7 | #853 p5.js, #854 C2.js, #855 C2.js interactive, #856 SVG, #857 A-Frame, #858 Three.js | create, sound, regular view per engine | Codex + Chrome |
| 8 | #859 | Immersive view sweep, six engines | Codex + Chrome |
| 9 | #860 | Embed view sweep, six engines | Codex + Chrome |
| 10 | #861 | Extracted Full and Non-Camera ZIP sweep | Codex + Chrome |
| 11 | #862 | Workflow-validity report (6x9 matrix, verdicts, gaps to issues) | docs |

Design choices: one surface per issue (regular per engine; immersive, embed and
ZIP as finite six-engine matrices) per the atomicity rules; a shared objective
"serene scene" definition (six named layers, slow motion 0.1-15% pixel change per
second, no console errors); each result ends in a verdict VALID / VALID WITH GAPS /
INVALID with failures filed as new issues.

## Boundaries
- Local disposable stack with real Chrome audio only; production data actions are not authorized by these issues; published verification stays with #806.
- Audio assertions need an engine state hook; if absent the issue records a verification boundary and files a new issue.
- Camera, microphone and theremin are out of scope (see camera-synthetic-verification-gap memory).
