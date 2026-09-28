# Accessibility conventions (WCAG-aligned)

See [`CONVENTIONS.md`](../../CONVENTIONS.md). This app is well ahead of
where a small app usually is on accessibility — `docs/plan.md` (lines
406-427) names it a **V1 requirement**, not a stretch goal, and the code
backs that up. This page formalizes what's already there and names the
real, evidenced gaps.

## What's already solid — the pattern to keep using

- **A shared `frontend/src/a11y/` hook library**, reused across many
  components instead of each one reinventing focus/keyboard logic:
  `useAlertDialogFocus` (WAI-ARIA alertdialog — focus-in on open, Escape
  dismisses without ever mapping to the destructive action, focus-return on
  close; used by `EditorWorkspace`'s exit-confirm, `BehaviorCardsPanel`'s
  binding-conflict confirm, `VersionHistoryPanel`'s delete-version confirm),
  `useMenuButton` (WAI-ARIA Menu Button), `useRovingRadioGroup` (WAI-ARIA
  Radio Group — used by `BehaviorCardsPanel`, `DemoControlsPanel`,
  `AIProposalPanel`, `ReducedMotionControl`, `SnapPreferenceControl`), and
  `reducedMotion.ts` (system-preference + manual override, degrade-not-
  disable).
- **11 dedicated `*.a11y.test.tsx` files** using `jest-axe` (`Camera
  Control`, `PublicProjectViewer`, `VersionHistoryPanel`, `AIProposalPanel`,
  `EditorWorkspace`, `Gallery`, `ExportConfigDialog`, `DraftRecoveryPrompt`,
  `GraphView`, `OnboardingHints`, `PublicGallery`).
- **A real skip link** (`.skip-link` in `index.css`, off-screen via `top:
  -100px` — not `display:none`, so it stays in Tab order — rendered from
  `Layout.tsx`).
- **Global + 20+ component-specific `:focus-visible` rules** — a catch-all
  (`a:focus-visible, button:focus-visible, ...`) plus per-component
  overrides for the editor toolbar, camera overlay, canvas swatches, shape
  handles, and more.
- **A schema-level `altText`/`decorative` contract** on image shapes
  (`schema/scene.schema.json`): `altText` (required unless `decorative` is
  `true`), with fixture coverage on both branches. Note: this exact
  conditional was buggy once (issue #508 — a bare `properties` check is
  vacuously true when the keyed property is absent under JSON Schema's
  open-world semantics) and is documented as a generalizable lesson in
  `.agents/memory/json-schema-properties-open-world.md`. **Rule:** any new
  schema-level "field X required unless flag Y is true" conditional pairs
  the `if`/`then` with an explicit `"required": ["Y"]` inside the `not`
  branch — don't repeat that bug.
- **Consistently labeled forms** — `AccountSettings.tsx`/`AdminSettings.tsx`
  label every input (`<label htmlFor>` matching a real `id`, or a wrapping
  `<label>`), and associate errors via `aria-describedby`.

## Real, evidenced gaps

1. **No documented contrast-ratio target.** `index.css`'s `:root` color
   tokens (`--text`, `--bg`, `--accent`, etc.) are raw hex/rgba values, both
   light and dark variants exist, but nothing states an intended WCAG AA
   (4.5:1 normal text / 3:1 large text) or AAA ratio, so no contrast-audit
   tool has ever been run against them as a gate. Filed as its own issue:
   define the target, audit the current tokens against it.
2. **`PieceCard.tsx:76` hardcodes `alt=""`** where every sibling card
   component (`ProjectCard.tsx`, `Project3DCard.tsx`, `PublicProjectCard.
   tsx`) uses a real descriptive `alt={`Preview of ${title}`}`. One
   inconsistency, one-line fix — filed as its own issue. **Rule stated
   explicitly now:** card thumbnails get `Preview of {title}`, not empty
   alt; a genuinely decorative image (a background flourish, a repeated
   icon) gets `alt=""` deliberately, not by omission.
3. **`useAlertDialogFocus` doesn't trap Tab inside the dialog** — a
   deliberate choice per its own doc comment, since none of its three
   current callers render in a portal. This is fine today; restated here so
   it's a documented exception rather than something a future portal-
   rendered dialog silently inherits without re-checking.
4. **Backend `login.html`/`base.html` have no skip link** — the frontend
   does. Low severity today (these are single centered-card pages with
   minimal navigation), worth adding if this surface grows more complex.
5. **`@media (prefers-reduced-motion: reduce)` is used directly in CSS in
   only two places**; almost everything else correctly routes through the
   `reducedMotion.ts` JS store instead. State this explicitly as the rule —
   "prefer the `useReducedMotion()`-consuming store; use the raw media
   query in CSS only for a purely-CSS transition with no JS involvement" —
   so it doesn't silently drift into two competing mechanisms.

## What's not yet machine-enforced

`jest-axe` catches structural ARIA-attribute errors on the components it's
run against — it does not check color contrast, does not check every
component (only 11 files have `.a11y.test.tsx` coverage today), and does
not verify keyboard behavior beyond what a test explicitly asserts. Treat
axe-clean as a floor, not a ceiling.
