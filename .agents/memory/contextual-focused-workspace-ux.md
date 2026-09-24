---
name: contextual-focused-workspace-ux
description: Owner wants editor controls contextual and progressively disclosed in familiar menus; avoid clunky, unfocused workspaces
metadata:
  type: feedback
---

Owner (2026-09-24): keep the workspace focused; show tools only where their context needs them (draw tools in Draw mode, transform/animation when an object is selected, proportion toggle only when non-uniform resize is possible), in menus that feel natural to most people.

**Why:** a wall of always-visible controls clutters the editor; the owner explicitly worried about a "clunky, unfocused" workspace.
**How to apply:** for editor-facing issues, add an acceptance check that the default workspace shows no unrelated controls and each control is at most two interactions away. Related: [[layer-visual-selection-contract]], [[generated-zip-export-parity-gaps]]. Backlog: #775, #776, #781-#784.
