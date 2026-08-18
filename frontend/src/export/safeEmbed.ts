/**
 * Task 56 (issue #57): safe-serialization helpers for the standalone HTML
 * export. This module is the single place that turns user-controlled
 * strings (project title/description, and every string field nested
 * inside a scene document — shape/layer/group names, color strings, etc.)
 * into text that can be embedded into a static HTML document without
 * letting any of it escape its intended data context and execute as
 * markup or script.
 *
 * ## Threat model
 *
 * The exported file is a plain `.html` file a viewer opens directly in a
 * real browser — there is no CSP, no sandboxing, and no server in
 * between to sanitize anything. Every string this module embeds could,
 * in principle, contain something like:
 *
 *   </script><script>alert(document.cookie)</script>
 *
 * or an HTML-attribute-breakout attempt like `"><img src=x onerror=...>`.
 * Two independent embedding contexts exist in the generated document,
 * and each needs its own escaping:
 *
 * 1. **HTML text/attribute context** (the `<title>`, `<meta
 *    name="description" content="...">`, the visible `<h1>`, and the
 *    optional description panel). `escapeHtml` below escapes the five
 *    characters that matter in both HTML text and (double-quoted or
 *    single-quoted) attribute contexts: `&`, `<`, `>`, `"`, `'`.
 * 2. **JSON-inside-`<script>` context** (the scene document, plus a small
 *    config object). Handled by `embedJsonScript` below.
 *
 * ## Why `<script type="application/json">` + `.textContent`, not
 * inline JS interpolation
 *
 * A common (and dangerous) pattern is `var x = ${JSON.stringify(data)};`
 * inside a `<script type="text/javascript">` block. Even with
 * `JSON.stringify`, that string is **not** safe to splice into an
 * executing script: `JSON.stringify` does not escape `/`, so a string
 * value containing the literal text `</script>` closes the enclosing
 * `<script>` tag early (the HTML parser looks for that byte sequence in
 * "raw text" mode regardless of what JS is or isn't inside it), and
 * whatever follows in the attacker-controlled string is then parsed as
 * new HTML/script content — a textbook stored-XSS breakout.
 *
 * This module avoids interpolating scene data into *executable* JS at
 * all. Instead, the data is written into a `<script type="application/
 * json">` element and read back with `JSON.parse(element.textContent)`
 * at runtime:
 *
 * - `type="application/json"` is still, per the HTML spec, a "script"
 *   element in raw-text parsing mode — the *only* thing that can
 *   prematurely end it is the literal (case-insensitive) byte sequence
 *   `</script`. It is never parsed or executed as JavaScript by the
 *   browser, so even a successful tag-close-and-reopen inside it can
 *   only inject markup into the surrounding document, not run as script
 *   by virtue of living inside this element.
 * - `.textContent` (not `.innerHTML`) is used to read it back, so even
 *   if some markup *did* end up inside the element, reading it never
 *   re-parses it as HTML.
 *
 * ## Defense in depth: escaping `</script` regardless
 *
 * Relying solely on "it's not parsed as JS" would still leave an HTML
 * hazard: an unescaped `</script` inside the JSON text ends the element
 * early at the HTML-parsing layer, and whatever text follows becomes
 * literal document content (broken formatting at worst) or, in an
 * adjacent `<script>` block, a genuine breakout. `embedJsonScript`
 * therefore *also* escapes every `<` in the serialized JSON as the
 * Unicode escape `<`. This is the standard technique used by
 * frameworks' "safe JSON script" helpers (e.g. Django's `json_script`):
 * `<` is valid inside a JSON string literal and decodes back to
 * `<` exactly under `JSON.parse`, so no information is lost, and no
 * substring of the output can ever contain a literal `<` — which means
 * `</script`, `<!--`, `<style`, or any other HTML-significant tag can
 * never appear, obfuscated or not (case changes, whitespace tricks, and
 * Unicode look-alikes are irrelevant when the character `<` itself never
 * appears in the output at all).
 */

/** Escapes the five HTML-significant characters for safe use as HTML text
 * content or inside a quoted HTML attribute value. Applied to every
 * user-controlled string (title, description) written directly into the
 * document body/head outside a JSON script block. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Serializes `data` as JSON and escapes every `<` as `<` so the
 * result can never contain `</script`, `<!--`, or any other
 * HTML-parser-significant tag-open sequence — see the module doc comment.
 * Also escapes the JS-string-breaking (but HTML-legal) U+2028/U+2029
 * separators for defense in depth, in case this text is ever read by
 * something other than `JSON.parse` (it is not, today, but escaping them
 * costs nothing and closes off a whole historical class of "safe JSON in
 * script tags" bugs). */
export function safeJsonForScriptTag(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003C')
    .replace(new RegExp('\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\u2029', 'g'), '\\u2029');
}

/** Builds a complete `<script type="application/json" id="...">...
 * </script>` element string embedding `data` safely — see the module doc
 * comment for why this shape (rather than interpolating into an
 * executing script) is the safe pattern. The companion runtime script
 * must read it back with
 * `JSON.parse(document.getElementById(id).textContent)`. */
export function embedJsonScript(id: string, data: unknown): string {
  const safeId = escapeHtml(id);
  return `<script type="application/json" id="${safeId}">${safeJsonForScriptTag(data)}</script>`;
}
