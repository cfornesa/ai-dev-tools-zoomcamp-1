---
name: css-hidden-attribute-silently-overridden
description: A same-specificity author CSS rule can silently defeat the `hidden` HTML attribute at every viewport, not just the one the rule targets; verify with getComputedStyle, not just DOM presence of the attribute.
metadata:
  type: feedback
---

An element toggled with React's `hidden={!open}` can still compute to
`display: flex`/`block` even while the `hidden` attribute is present,
because CSS origin-then-specificity rules mean **any** author stylesheet
declaration of equal or higher specificity beats the browser's UA-stylesheet
`[hidden] { display: none }` rule, regardless of source order or which
media query wrote it.

Concretely (#584): `AdminConsoleNav.tsx`'s mobile hamburger menu had
`.admin-console-menu { display: flex }` (desktop, unconditional — this part
is intentional, since the toggle button itself is `display: none` above
700px) and, inside `@media (max-width: 700px)`, a sibling
`.admin-console-menu { flex-direction: column }` rule with the *same*
specificity. Neither rule scoped to `[hidden]`, so the desktop rule kept
winning at every width by source order, and the "collapsed" mobile menu's
four nav links stayed visible and keyboard-focusable regardless of
`aria-expanded`. `jsdom`-based unit tests never caught this because Vitest's
jsdom environment doesn't load the real stylesheet at all — `getByRole`
correctly excluded the hidden-attribute element from the a11y tree in every
test, masking the exact bug that was live in the browser.

**Why:** this is a general CSS-cascade gotcha, not specific to React or this
component — any toggle pattern built on the `hidden` attribute plus a class
selector of matching specificity is at risk the moment a media query touches
that same class without re-asserting `display: none` under `[hidden]`.

**How to apply:** when reviewing or QA-ing a component that toggles
visibility via the `hidden` attribute, don't trust `hasAttribute('hidden')`
or a unit test's `getByRole` exclusion as proof the browser actually hides
it — call `getComputedStyle(el).display` in a live/real browser (or your
review) and confirm it says `none`. If a class selector governs the same
element from more than one rule (base + media query), add an explicit
`.the-class[hidden] { display: none }` override scoped to wherever the
`hidden` semantics must actually win, rather than assuming attribute-based
hiding "just works" against class-based show rules.
