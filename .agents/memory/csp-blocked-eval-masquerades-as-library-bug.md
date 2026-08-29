---
name: csp-blocked-eval-masquerades-as-library-bug
description: A strict CSP with no 'unsafe-eval' silently breaks A-Frame's own system-initialization code, throwing a cryptic "a[e] is not a constructor" deep inside aframe.min.js that looks like a library bug, not a CSP problem. Cross-origin script errors are also masked as generic "Script error." unless the <script> tag has crossorigin="anonymous".
metadata:
  type: project
---

After fixing #236's pinned A-Frame CDN 404 (see
[[pinned-cdn-version-can-silently-404]]), the live production preview
started showing a *new* failure: "The generated piece could not render:
Script error." with no further detail.

**Step 1 — unmask the error.** The sandboxed iframe loads
`aframe.min.js` cross-origin via `<script src="https://cdn.jsdelivr.net/...">`
with no `crossorigin` attribute. Per the WHATWG/browser spec, an
uncaught error thrown by a cross-origin script with no CORS-enabled
`crossorigin` attribute is reported to `window.onerror`/`error` event
listeners as the generic, detail-free `"Script error."` (message, no
filename/lineno/stack) — a browser security feature to stop leaking
cross-origin script internals, not a bug in this app's error listener.
Reproducing the same load in a standalone sandboxed iframe with
`crossorigin="anonymous"` added revealed the real error:

```
Uncaught TypeError: a[e] is not a constructor
    at v.initSystem (aframe.min.js:1:424820)
    at v.initSystems (aframe.min.js:1:424716)
    at v.doConnectedCallback (aframe.min.js:1:424338)
    at v.onReadyStateChange (aframe.min.js:1:405872)
```

**Step 2 — bisect the CSP, not the markup.** The exact same scene
markup (camera + circle + two lights) loaded fine with no CSP present,
but failed reliably (3/3) with the app's real CSP (`default-src 'none';
script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src
'unsafe-inline';`). Testing individual directive additions isolated the
cause to `'unsafe-eval'`: adding it to `script-src` fixed the failure
0/3 (previously 3/3), while adding `worker-src`, `connect-src`, or
switching `default-src` to `'self'` did not help. A-Frame's own
system-registry lookup during scene `connectedCallback` calls a dynamic
eval/`Function` constructor internally — with `'unsafe-eval'` absent,
that call is silently blocked by the CSP and the registry lookup
returns something not usable as a constructor, producing the unrelated
-looking `TypeError`. Three.js needed no such allowance (its own script
ran fine under the stricter policy), so the fix
(`frontend/src/generative/artPieceSandbox.ts`'s `buildCsp()`) scopes
`'unsafe-eval'` to the `aframe` branch only, not every library.

**Why this was hard to find:** CSP-blocked `eval`/`new Function()`
calls do not always produce a clearly-CSP-flavored error (an
`EvalError` or a `securitypolicyviolation` event) — depending on how
the calling code uses the result, the failure can surface several
stack frames downstream as a completely unrelated-looking `TypeError`,
here inside a third-party minified bundle with no readable symbol
names. Combined with the cross-origin `"Script error."` masking, the
actual failure was two layers removed from anything directly
informative.

**How to apply:**
1. When a cross-origin `<script src>`'s failure is reported as the
   generic `"Script error."`, add `crossorigin="anonymous"` to a
   standalone reproduction of that exact script tag (not necessarily to
   the shipped code, which may have reasons not to — e.g. no CORS
   preflight needed for existing behavior) to unmask the real message
   before debugging further; don't try to debug from `"Script error."`
   alone.
2. When a third-party library throws an unrelated-looking
   `TypeError`/`ReferenceError` immediately after a CSP was added,
   tightened, or is otherwise novel to the environment (a sandboxed
   iframe, a Content-Security-Policy meta tag, an extension's script
   isolation), bisect the CSP directives (test scene reproduction with
   the policy present vs. absent, then add candidate directives one at
   a time) *before* assuming the library itself has a bug or that the
   generated content is malformed — a CSP-blocked internal `eval` is a
   plausible, easy-to-miss cause for exactly this failure shape.
3. If any future report says an A-Frame art piece throws a script error
   with no useful detail, check `'unsafe-eval'` in the sandbox's CSP
   first — see `buildCsp()` in `artPieceSandbox.ts`.
