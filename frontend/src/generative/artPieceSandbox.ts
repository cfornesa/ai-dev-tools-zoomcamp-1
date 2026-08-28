/**
 * Issue #199 (epic #196): builds the sandboxed document that renders a
 * raw, AI-generated Canvas2D art-piece snippet returned by
 * `POST /api/ai/art-pieces/generate/` (`../api/artPieces.ts`).
 *
 * ## This is the actual security control, not the server's system prompt
 *
 * Per issue #197's architecture decision, a generated piece is a new,
 * fully untrusted trust boundary. The backend (`ai_provider/art_piece_
 * provider.py`) asks Mistral for network-free, self-contained code, but
 * that request is not a security control -- nothing stops a model from
 * ignoring it. Safety comes entirely from how this module renders the
 * result:
 *
 * 1. The document this function returns is only ever loaded into an
 *    `<iframe sandbox="allow-scripts">` via `srcdoc` -- **never**
 *    `allow-same-origin`, and never a `src` pointing at this app's own
 *    origin. Omitting `allow-same-origin` gives the iframe a permanently
 *    opaque ("null") origin, so even if the generated code tries to read
 *    `document.cookie`, `localStorage`, or reach this app's own `/api`
 *    surface via a same-origin credentialed request, none of that
 *    succeeds -- there is no origin for those APIs to succeed *as*.
 * 2. A strict Content-Security-Policy `<meta>` tag is injected by this
 *    function itself -- never left to the AI's own output to include
 *    correctly (it can't be trusted to). `default-src 'none'` blocks any
 *    network egress (fetch/XHR/WebSocket/images/fonts/frames/etc.) the
 *    generated script might still attempt despite the system prompt;
 *    `script-src`/`style-src 'unsafe-inline'` allow only the inline
 *    `<script>`/styling this function itself controls the shape of.
 * 3. An inert error/ready listener (this module's own code, never the
 *    AI's) is placed *before* the untrusted snippet in document order,
 *    so it's already registered before the snippet's own `<script>` runs.
 *    It reports success/failure to the parent via `postMessage` -- the
 *    only channel available to an opaque-origin sandboxed iframe -- so
 *    the caller (`ArtPieceStudio.tsx`) knows whether to enable Download.
 *
 * `parseArtPieceSandboxMessage` is the parent-side counterpart: since a
 * sandboxed iframe with no `allow-same-origin` always has an opaque
 * origin, a `message` event's `event.origin` is the literal string
 * `"null"` for every such iframe indiscriminately -- it cannot be used to
 * distinguish this sandbox from any other opaque-origin content on the
 * page. The caller must instead check `event.source === iframe
 * .contentWindow` (an object identity check, not an origin/string check)
 * before trusting a message's contents; this module only handles parsing
 * the payload once that identity check has already passed.
 */

export const ART_PIECE_SANDBOX_MESSAGE_SOURCE = 'art-piece-sandbox';

export type ArtPieceSandboxMessage =
  | { source: typeof ART_PIECE_SANDBOX_MESSAGE_SOURCE; status: 'ready' }
  | { source: typeof ART_PIECE_SANDBOX_MESSAGE_SOURCE; status: 'error'; message: string };

/** The exact `sandbox` attribute value every art-piece preview iframe must
 * use. Exported as a single constant (rather than inlined at each call
 * site) so a test can assert the literal string never grows
 * `allow-same-origin` (or any other capability) by an incautious future
 * edit -- see `artPieceSandbox.test.ts`. */
export const ART_PIECE_IFRAME_SANDBOX = 'allow-scripts';

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';";

/** This function's own code -- never the AI's output -- registers the
 * error/ready listeners before the untrusted snippet's `<script>` runs
 * (document order = execution order for synchronous inline scripts), so
 * even a snippet that throws synchronously during its own top-level
 * evaluation is still caught. */
const LISTENER_SCRIPT = `
<script>
(function () {
  function report(status, message) {
    try {
      window.parent.postMessage(
        { source: ${JSON.stringify(ART_PIECE_SANDBOX_MESSAGE_SOURCE)}, status: status, message: message },
        '*'
      );
    } catch (e) {
      // The parent frame is the only postMessage target; if that somehow
      // throws, there is nothing else this sandbox can do to report it.
    }
  }
  window.addEventListener('error', function (event) {
    report('error', (event && event.message) || 'The generated piece threw an error.');
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    report('error', (reason && reason.message) || String(reason) || 'An unhandled promise rejection occurred.');
  });
  window.addEventListener('load', function () {
    // Two animation frames: one to let the snippet's own first paint
    // happen, one more so a same-frame synchronous throw from that first
    // paint has already been caught by the error listener above before
    // this reports success.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        report('ready', '');
      });
    });
  });
})();
</script>
`;

/** Builds the full sandboxed document for `srcdoc`. `snippet` is the raw,
 * unmodified string `POST /api/ai/art-pieces/generate/` returned --
 * expected to be a `<canvas>` + `<script>` pair per the backend's system
 * prompt, but this function does not parse or validate its shape: the
 * sandbox (CSP + `allow-scripts`-only iframe) is what makes any content
 * here safe to render, not a check on what the content contains. */
export function buildArtPieceSandboxDocument(snippet: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>
  html, body { margin: 0; padding: 0; background: #ffffff; }
  canvas { display: block; max-width: 100%; }
</style>
${LISTENER_SCRIPT}
</head>
<body>
${snippet}
</body>
</html>`;
}

/** Parses a `message` event's `data` into a typed
 * `ArtPieceSandboxMessage`, or `null` if it doesn't match the shape this
 * module's own `LISTENER_SCRIPT` produces. Callers must independently
 * verify `event.source === iframe.contentWindow` before calling this --
 * see this module's own doc comment for why `event.origin` can't do that
 * job for an opaque-origin sandboxed iframe. */
export function parseArtPieceSandboxMessage(data: unknown): ArtPieceSandboxMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.source !== ART_PIECE_SANDBOX_MESSAGE_SOURCE) return null;
  if (record.status === 'ready')
    return { source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'ready' };
  if (record.status === 'error') {
    return {
      source: ART_PIECE_SANDBOX_MESSAGE_SOURCE,
      status: 'error',
      message: typeof record.message === 'string' ? record.message : 'Unknown error.',
    };
  }
  return null;
}
