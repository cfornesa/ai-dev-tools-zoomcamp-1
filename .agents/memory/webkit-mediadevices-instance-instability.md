---
name: webkit-mediadevices-instance-instability
description: CONFIRMED — in a sandboxed opaque-origin iframe, WebKit does not treat navigator.mediaDevices as a stable object; each access can return a fresh instance. Mock getUserMedia by patching MediaDevices.prototype, never the instance.
metadata:
  type: project
---

Issue #454: `artPieceCameraRuntime.spec.ts`'s `mockCamera` helper patched
`navigator.mediaDevices.getUserMedia` via `Object.defineProperty` on the
*instance* returned by one access, inside a `context.addInitScript`
callback. This worked reliably on Chromium and Firefox but was silently
broken on WebKit, specifically inside the art-piece sandbox's
`<iframe sandbox="allow-scripts">` (no `allow-same-origin`, opaque/null
origin).

Root-caused via temporary `console.log`/`Object.getOwnPropertyDescriptor`
diagnostics directly inside the mock and via `page.evaluate` immediately
before the button click that triggers `getUserMedia`: the `defineProperty`
call itself never threw and reported success, yet `typeof
navigator.mediaDevices.getUserMedia` was back to `"function"` (the real
native method) by the time the sandbox script actually called it. WebKit
does not cache a single `MediaDevices` object for `navigator.mediaDevices`
in this restricted iframe context the way Chromium/Firefox do — each
property access can return a distinct instance, so patching one instance
never affects a later access's different instance.

Practical consequence for this suite before the fix: `'unavailable'`
silently fell through to a real native `getUserMedia` call (headless, no
camera, naturally rejecting) instead of skipping the call entirely;
`'granted'` could never resolve at all (timeout); `'denied'` *looked*
correct only because a real ungranted native call also rejects with the
same visible text — that scenario was never actually exercising the mock.

**Fix:** patch `MediaDevices.prototype.getUserMedia` (via
`Object.getPrototypeOf(window.navigator.mediaDevices)`), not the instance.
The prototype is shared by every instance WebKit creates, so the mock
survives regardless of instance churn. Confirmed the prototype property is
itself `configurable: true`, so this is a safe, one-line change in shape
from the original.

A second, related but distinct hazard found in the same investigation:
`context.addInitScript` calls accumulate across navigations on one
context — calling it repeatedly with different outcomes (as this test did,
once per phase) leaves *all* prior scripts registered, and while
Chromium/Firefox always applied the most-recently-added one in time,
WebKit sometimes didn't (a genuine injection-timing race, worse the more
scripts accumulate). Fixed by using one fresh `BrowserContext` per mock
outcome (`browser.newContext({ storageState })`, carrying the already
logged-in session instead of re-driving the UI login), so exactly one
`addInitScript` call is ever active for any given navigation.

**How to apply:** any future `getUserMedia`/`getDisplayMedia`/similar
`navigator.mediaDevices`-based mock added for a sandboxed iframe or
cross-origin context must patch `MediaDevices.prototype`, not the instance
returned by `navigator.mediaDevices` — verify this explicitly on WebKit if
the suite runs there, since Chromium/Firefox will mask the bug. Prefer a
fresh context per distinct mock configuration over repeated
`context.addInitScript` calls with different values on one context.
