# Design & UX conventions

See [`CONVENTIONS.md`](../../CONVENTIONS.md). This app has **no UI
component library** (confirmed: no MUI, Chakra, Radix, Tailwind, Bootstrap
— 100% hand-rolled JSX plus one 7,958-line global stylesheet, `frontend/
src/index.css`). The owner's direction: **formalize the hand-rolled system
as this app's design system**, with room for a **mixed approach** where an
unstyled primitives library would genuinely out-perform a hand-rolled
pattern on longevity/dependability — evaluated per-pattern, not as a
blanket migration. This page covers Nielsen's 10 usability heuristics,
Jakob's Law (users expect your app to behave like the apps they already
know), Hick's Law (fewer/grouped choices reduce decision time), and Fitt's
Law (target size and distance affect ease of use) — each grounded in real
findings, not generic checklist prose.

## The existing token system — real, worth formalizing

`index.css`'s `:root` (lines ~25-63) defines color tokens (`--text`,
`--bg`, `--accent`, etc.), font tokens (`--sans`, `--heading`, `--mono`),
and a `--site-radius`/`--site-density` pair — redefined per theme via a
`data-theme="dark"` attribute and a `prefers-color-scheme` media query
(both target the *same* token names), plus a parallel `data-site-backdrop`/
`data-site-shadow`/`data-site-font` attribute system letting users pick
cosmetic variants without touching component CSS. **This is real,
formalizable design-token architecture** — document it as the app's
official token system rather than leaving it implicit.

**Real bug, not a style choice:** `--space-1` and `--space-3` are *used*
(e.g. `padding: var(--space-1)` at multiple call sites) but **never
defined** anywhere in `index.css` — only `--space-2/4/6/8` (8px steps)
exist. With no CSS fallback supplied at any usage site, these properties
silently resolve to their initial value, collapsing the intended
gap/padding to nothing. Filed as its own issue, `owner-priority` — this is
the highest-value single fix on this page: cheap, mechanical, and it's an
actual rendering bug hiding as if it were a design decision.

Beyond the numbered scale, most spacing in the 7,958-line file is ad hoc
px/rem tuned per component. **Rule going forward:** new spacing values use
the existing `--space-*` scale (defining the missing `--space-1`/`--space-3`
first); a genuinely one-off value gets a comment saying why the scale
doesn't fit, rather than silently adding a new unscaled number.

## Fitt's Law: touch-target size is real but inconsistently applied

44px (WCAG 2.5.5 / common mobile-platform guidance) is already enforced in
several places — `.shell-action` (regular/account surfaces, `AccountSettings
.tsx`/`ProjectCard.tsx`), `.piece-stage-icon-button` (2.75rem = 44px,
`PieceStageControls.tsx`'s toolbar). It's **undercut** in others:
`.admin-console-nav-button` (40px, the actual admin section nav) and
`.publish-visibility-option` (32px, a toggle). **Rule:** state 44px as this
app's minimum interactive-control dimension explicitly (it isn't stated
anywhere today, only inferred from the majority of controls), and bring the
two undersized cases up to it. Filed as its own issue.

## Jakob's Law / heuristic #4 (consistency and standards): admin vs.
regular surfaces share a palette, not a shape language

Admin (`admin-action-primary`/`-secondary`/`-danger`, `AdminSettings.tsx`/
`AdminContent.tsx`) and regular (`.shell-action`, `AccountSettings.tsx`/
`ProjectCard.tsx`) buttons both draw from the same color tokens (`--accent`,
`--bg`, `--text-h`) but diverge in shape: admin buttons only set
`border-radius`/`font-weight`, inheriting the smaller bare-`button` padding
(6px 14px), while `.shell-action` explicitly sets `min-height: 44px;
padding: 8px 16px`. Same brand, not the same feel — a real Jakob's-Law-
relevant inconsistency between the app's two main surfaces. Filed as an
**owner-decision issue**: which shape wins (or a third, reconciled one),
since this is a visual-identity call, not a mechanical fix.

## Hick's Law: grouping exists, progressive disclosure doesn't (yet) on
every surface

`AdminSettings.tsx` (1,613 lines, 58 interactive controls) is chunked into
6 labeled `<section>`s with headings — real grouping — but all six render
simultaneously with zero collapse/disclosure. `PieceStageControls.tsx`
(1,789 lines, 35 controls) does better: capability-gated controls are
omitted from the DOM entirely when unsupported, and the whole panel is a
single `aria-expanded`-toggled accordion. Issue `#884` already shipped a
real Hick's-Law-motivated fix on this exact panel (icon-first controls with
hover/focus tooltips, replacing verbose always-visible labels) — but scoped
narrowly to that one panel, not `AdminSettings.tsx` or elsewhere. **Rule:**
a page with a comparable control count to `AdminSettings.tsx` should use
the same disclosure pattern `PieceStageControls.tsx` already has, not just
grouping. No issue filed to retrofit `AdminSettings.tsx` specifically yet —
that's a real "the guide names the pattern; the actual retrofit needs its
own scoped issue when someone picks it up," not something to invent
speculatively here.

## Heuristic #1 (visibility of system status) — already converging on an
idiom, formalize it

`EditorWorkspace.tsx`'s save-status region (`role="status" aria-live=
"polite"`) and `EntitlementsSummary.tsx`'s independent reimplementation
(`role="alert" aria-live="assertive"` for errors, `role="status"` for
loading) show the idiom emerging in two places without a shared component.
**Rule:** new async-status UI uses this same `role`/`aria-live` idiom.

## Heuristics #5/#6 (error prevention, recognition over recall) — the
`window.confirm()` question

Every destructive action in this app uses the native `window.confirm()` —
deliberately, per an explicit code comment in `ProjectCard.tsx:37` citing
issue #242. This is real design-system discipline in the narrow sense (one
idiom, cited, reused consistently across `ProjectCard.tsx`, `Project3DCard.
tsx`, `CollectionManagement.tsx`, `GraphView.tsx`, `AdminSettings.tsx`,
`AdminContent.tsx`, `AccountBilling.tsx`, `AdminPages.tsx`) — but it's also
a real limitation worth naming: native `confirm()` can't be styled to match
the app, can't show which downstream resources are affected, and offers no
higher-friction confirmation (e.g. "type DELETE") for higher-stakes actions
— `AdminSettings.tsx`'s permanent-delete-of-expired-remote-copies uses the
exact same unstyled dialog as a routine project delete. **This is the
strongest case in this codebase for the mixed-library option below**: a
styled, accessible dialog primitive would directly fix this without
touching the app's visual identity elsewhere. Filed as an **owner-decision
issue**, not a unilateral change — the existing pattern is deliberate and
its replacement needs the same sign-off #242 originally got.

## No single entitlement-gating UI pattern

Paid-feature gating is inconsistent: `PieceStageControls.tsx` **hides
entirely** capability-gated controls from the DOM when unsupported;
`CloudSyncControl.tsx` **shows the control with explanatory prose** next to
a `disabled` state instead. Both are reasonable choices in isolation, but
having both live side by side means a user's mental model of "why can't I
do this" differs by which page they're on — a real Jakob's/heuristic-#4
inconsistency. Filed as an **owner-decision issue**: pick one pattern (or a
principled rule for when each applies — e.g. hide when the control would be
meaningless without the entitlement, show-with-caption when it's genuinely
"you could do this if you upgraded") and retrofit the other.

## The mixed-system option: unstyled primitives for WAI-ARIA plumbing

This app already hand-builds the exact interaction patterns that libraries
like Radix UI or React Aria/Headless UI exist to provide: `useAlertDialog
Focus`, `useMenuButton`, `useRovingRadioGroup` (see [`react.md`](react.md)/
[`accessibility.md`](accessibility.md)). These hooks work today and are
tested — this is **not** a "the hand-rolled version is broken" argument.
The case *for* an unstyled primitives library, evaluated per-pattern rather
than as a migration:
- **Longevity/dependability**: a maintained library absorbs new WAI-ARIA
  spec changes and edge cases (RTL, nested portals, mobile Safari quirks)
  that a hand-rolled hook has to catch one bug report at a time.
  `useAlertDialogFocus`'s own documented limitation (doesn't trap Tab,
  because none of its callers currently render in a portal) is exactly the
  kind of edge case that stops being "fine for now" the moment a caller
  changes.
- **Where it fits without disturbing the visual system**: an *unstyled*
  primitives library supplies behavior/accessibility only — this app's
  actual visual identity (the token system above) stays untouched, so
  adopting one for, say, the dialog/menu/radio-group primitives is not the
  same kind of decision as adopting a full styled component library (MUI,
  Chakra) that would compete with the existing token system.
- **What this page does *not* do**: pick a library, or commit to adoption.
  Filed as an **owner-decision issue** naming Radix UI and React Aria as
  concrete candidates to evaluate against the three existing hand-rolled
  hooks, with the `window.confirm()` replacement (above) as the most
  concrete first candidate pattern if the owner wants to pilot this on one
  real, already-identified pain point rather than in the abstract.

## What's not yet machine-enforced

None of this page is lint-checked. The `--space-1`/`--space-3` bug is the
one item here that's a genuine code defect rather than a convention gap —
everything else is a design-consistency/process question for the owner-
decision issues above.
