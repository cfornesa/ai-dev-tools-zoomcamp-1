---
name: Fullscreen browser Escape dialog state
description: Firefox and WebKit can preserve the stage command dialog after native fullscreen exits via Escape.
---

Native fullscreen Escape does not produce identical UI sequencing in every browser: Firefox can exit fullscreen while leaving the stage command dialog open, whereas Chromium closes it in the current Playwright runner.

**Why:** The Fullscreen API transition and the browser's normal Escape handling are ordered differently across engines, so a test that requires the dialog to be hidden immediately after Escape can fail even when fullscreen state and the command's `aria-pressed` state are correct.

**How to apply:** Keep Chromium's hidden-dialog assertion strict. For Firefox/WebKit, assert native fullscreen has exited first, close a still-open stage dialog through its normal control, then reopen it and assert the fullscreen command is unpressed.