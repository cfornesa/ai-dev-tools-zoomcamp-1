---
name: p5.js getUserMedia polyfill
description: p5.js polyfills navigator.mediaDevices.getUserMedia at load time; mocking it wrong crashes the bundle before React mounts.
---

`node_modules/p5/lib/p5.js` runs, at module-load time (not lazily), roughly:

```js
if (navigator.mediaDevices.getUserMedia === undefined) {
  navigator.mediaDevices.getUserMedia = function (constraints) { ... };
}
```

Any Playwright `addInitScript` (or other code) that mocks `getUserMedia` as
`undefined` via `Object.defineProperty` with the default `writable: false`
makes p5's own assignment above throw an uncaught strict-mode `TypeError`
during the bundle's module evaluation. That's an exception before React ever
mounts — it presents as the whole page "hanging" or the test timing out
waiting for any UI element, not as an obvious JS error, since Playwright's
`getByRole(...).click()` failure message shows only the locator timeout.

**How to detect this class of bug:** capture `page.on('pageerror', ...)` in
a standalone debug script and check `document.body.innerText` — a crashed
bundle leaves the DOM essentially empty, which a Playwright locator timeout
alone won't tell you.

**How to simulate "unsupported browser" (no `getUserMedia`) safely:** define
`getUserMedia` as an accessor property on the real, still-native
`navigator.mediaDevices` object — a getter that always returns `undefined`,
paired with a no-op setter that silently absorbs p5's polyfill assignment
instead of letting it throw:

```js
Object.defineProperty(window.navigator.mediaDevices, 'getUserMedia', {
  configurable: true,
  get() { return undefined; },
  set() { /* absorb p5.js's polyfill assignment */ },
});
```

Do not redefine `navigator.mediaDevices` itself (the whole object) — that
breaks other native machinery on the page independently of this issue.

**Why:** Found while fixing issue #119 — the app's public-viewer "Enable
camera" button never appeared when `publishingAndRemix.spec.ts` mocked a
missing `getUserMedia`; the app's own `defaultIsSupported()` logic in
`frontend/src/tracking/mediapipeProvider.ts` was already correct.

**How to apply:** When writing or debugging a Playwright `addInitScript`
that mocks `navigator.mediaDevices` (or any other global p5.js also touches
at load time), check `node_modules/p5/lib/p5.js` for its own guarded
polyfills before assuming a test-only global is safe to mock with a plain
`Object.defineProperty` value.
