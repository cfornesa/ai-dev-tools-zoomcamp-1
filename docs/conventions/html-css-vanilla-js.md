# HTML, CSS, and vanilla JavaScript conventions

Scope: everywhere this app emits or hand-writes raw markup/styles/script
outside React/TSX and Python. See [`CONVENTIONS.md`](../../CONVENTIONS.md).

## Four real surfaces, four different jobs — know which one you're in

1. **`backend/templates/`** — 11 Django server-rendered `.html` files, all
   `django-allauth` account flows. Convention already in force: template
   inheritance (`{% extends %}`/`{% block %}`), CSRF tokens, semantic
   headings, `<label for=...>` on every input, a visible focus rule
   (`input:focus, button:focus, a:focus { outline: 3px solid ...; outline-
   offset: 2px }` in `account/base.html`), `lang="en"` on `<html>`. Real
   gap: no skip link here (the frontend has one) — low severity given these
   pages are single centered cards, but worth adding if this surface grows.
2. **`frontend/src/export/generateHtmlExport.ts`** — generates the
   downloaded/exported piece's standalone `index.html`. This is genuinely
   good practice, already: semantic sectioned HTML (`<section aria-
   labelledby=...>`), ARIA roles/labels throughout, every user-controlled
   string run through `escapeHtml` before interpolation, and
   `embedJsonScript`'s `<script type="application/json">` + `.textContent`
   pattern for passing scene data into the runtime `<script>` — never
   echoing JSON into an HTML attribute. **Rule:** any new generated-export
   surface follows this exact pattern (escape every string, embed data via
   `<script type="application/json">`, never `eval`/`Function()` — the
   in-code comments in `ai_provider/art_piece_provider.py` and
   `ai_provider/prompts.py` already warn against this for generated
   front-end code; extend that warning to any hand-written generator too).
3. **`frontend/src/export/codeGrammar.ts`** — the in-app Code tab's
   bidirectional HTML/CSS/JS ↔ scene editor. This is the strongest existing
   model for "safe, constrained, generated code": exactly one root
   `<main id="scene-shapes">`, one `<div>` per shape with a whitelisted
   `data-*`/class-token set, one CSS rule per shape id with a whitelisted
   property set, and every value regex-validated before it's
   embedded/parsed back — no `eval`, nothing free-text reaches a DOM
   attribute or style value unescaped. **Rule:** any future "generate a
   constrained code surface from structured data" feature follows this
   allowlist-then-validate model, not free-form templating.
4. **`frontend/index.html`/`frontend/src/index.css`** — the app shell.
   `index.html`'s inline theme-flash-prevention script is the pattern for
   any future "must run before paint" vanilla JS: small, wrapped in
   `try/catch`, reads one `localStorage` key, sets one `dataset` value, then
   gets out of the way. `index.css` (7,958 lines) defines a real light/dark
   + `data-site-*` attribute token system (`:root`, `:root[data-theme=
   'dark']`) — see [`design-ux.md`](design-ux.md) for the token-consistency
   findings (including a real bug: `--space-1`/`--space-3` are used but
   never defined).

## What's not yet machine-enforced

None of the above (the allowlist model, the escape-before-embed rule, the
skip-link parity between frontend and backend pages) is linted. This is a
review-checklist item, not a CI gate — say so plainly rather than implying
automated coverage that doesn't exist.
