---
name: generated-zip-export-parity-gaps
description: Generated-piece ZIP exports lack the live drawing toolset, use unstyled buttons, and stub c2; owner-reported "no controls" conflict is unresolved
---
# Generated ZIP export parity gaps (2026-09-24 distillation, #751-#762)

`generative/artPieceBundle.ts` exports plain unstyled `<button>` controls (regular presentation has no toolbar CSS), no c2js-interactive drawing toolset, and an inline three-method c2 stub instead of `c2.min.js`. The reference react-node export uses text `.portable-button`s and also lacks drawing. Owner reports "no controls at all" in downloads; source shows controls exist, so classify only after screenshotting an extracted ZIP (#755). Reference C2 canvas is 1280x720; this repo's 320x240 is a documented divergence awaiting owner decision (decided 2026-09-24: reference 1280x720, #763/#764). Closed #609/#670 remain valid for their own scope. Related: [[c2-opaque-sandbox-rendering]], [[authored-piece-surface-parity]].

Local repro: a c2 ZIP shows tiny default buttons under a 320x240 canvas; owner's button-less augmentrart.com download is likely Three.js/A-Frame covering the z-index-less nav (#755).
