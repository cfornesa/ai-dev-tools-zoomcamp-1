---
name: Stage command overlay browser checks
description: Browser-test contracts for the shared stage command overlay and its narrow editor submenus.
---

Use state-aware, uniquely scoped locators when testing the shared stage command overlay: its trigger changes accessible name when open, the dialog close button shares that name, and the action group lives inside the dialog card rather than directly under the outer toolbar.

**Why:** A real browser run can otherwise report false failures from strict-mode locator collisions or stale assumptions about the pre-overlay DOM. Narrow editor submenus also need their position measured against the stage/card boundary because their containing block is a small control wrapper.

**How to apply:** Prefer the dedicated trigger class plus `aria-expanded`, exact names for action commands, and a dialog-card-scoped group locator. Exercise both pointer and keyboard opening, then verify fullscreen state through `document.fullscreenElement` at the supported narrow viewport.