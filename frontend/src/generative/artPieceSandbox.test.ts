import { describe, expect, it } from 'vitest';

import {
  ART_PIECE_IFRAME_SANDBOX,
  ART_PIECE_SANDBOX_MESSAGE_SOURCE,
  buildArtPieceSandboxDocument,
  parseArtPieceSandboxMessage,
} from './artPieceSandbox';

const SNIPPET = '<canvas id="art-piece-canvas"></canvas><script>document.title = "hi";</script>';

describe('ART_PIECE_IFRAME_SANDBOX', () => {
  it('never includes allow-same-origin or any other capability beyond allow-scripts', () => {
    expect(ART_PIECE_IFRAME_SANDBOX).toBe('allow-scripts');
    expect(ART_PIECE_IFRAME_SANDBOX).not.toMatch(/allow-same-origin/);
    expect(ART_PIECE_IFRAME_SANDBOX.split(' ')).toEqual(['allow-scripts']);
  });
});

describe('buildArtPieceSandboxDocument', () => {
  it('embeds a strict, network-blocking Content-Security-Policy meta tag', () => {
    const doc = buildArtPieceSandboxDocument(SNIPPET);
    expect(doc).toContain('Content-Security-Policy');
    expect(doc).toContain("default-src 'none'");
  });

  it('places the error/ready listener script before the untrusted snippet in document order', () => {
    const doc = buildArtPieceSandboxDocument(SNIPPET);
    const listenerIndex = doc.indexOf('addEventListener');
    const snippetIndex = doc.indexOf(SNIPPET);
    expect(listenerIndex).toBeGreaterThan(-1);
    expect(snippetIndex).toBeGreaterThan(-1);
    expect(listenerIndex).toBeLessThan(snippetIndex);
  });

  it('embeds the snippet verbatim, unmodified', () => {
    const doc = buildArtPieceSandboxDocument(SNIPPET);
    expect(doc).toContain(SNIPPET);
  });

  it('#457: the ready handshake defers via setTimeout, not requestAnimationFrame, which Chromium throttles for an off-screen cross-origin iframe', () => {
    const doc = buildArtPieceSandboxDocument(SNIPPET);
    const loadHandlerIndex = doc.indexOf("addEventListener('load'");
    const readyReportIndex = doc.indexOf("report('ready', '')");
    expect(loadHandlerIndex).toBeGreaterThan(-1);
    expect(readyReportIndex).toBeGreaterThan(loadHandlerIndex);
    // Still two deferred ticks, matching the same-tick synchronous-throw
    // protection the prior requestAnimationFrame-based version had -- but
    // via setTimeout, which Chromium doesn't throttle by iframe visibility.
    const between = doc.slice(loadHandlerIndex, readyReportIndex);
    expect(between).not.toContain('requestAnimationFrame(');
    expect(between.match(/setTimeout\(function \(\)/g)).toHaveLength(2);
  });

  it('embeds the versioned, allowlisted parent command bridge', () => {
    const doc = buildArtPieceSandboxDocument(SNIPPET);
    expect(doc).toContain("data.source !== 'art-piece-parent'");
    expect(doc).toContain('data.version !== 1');
    expect(doc).toContain('art-piece-command');
    expect(doc).toContain('enable-hand-steering');
  });

  it("never references this app's own API/session surface", () => {
    const doc = buildArtPieceSandboxDocument(SNIPPET);
    expect(doc).not.toMatch(/\/api\//);
    expect(doc).not.toMatch(/document\.cookie/);
  });

  it("canvas2d/svg get the strict CSP, with jsdelivr/googleapis allowed only for hand-steering's vision model", () => {
    const canvasDoc = buildArtPieceSandboxDocument(SNIPPET, 'canvas2d');
    const svgDoc = buildArtPieceSandboxDocument('<svg id="art-piece-svg"></svg>', 'svg');
    for (const doc of [canvasDoc, svgDoc]) {
      expect(doc).not.toContain('<script src="https://cdn.jsdelivr.net');
      expect(doc).toMatch(
        /script-src 'unsafe-inline' 'wasm-unsafe-eval' https:\/\/cdn\.jsdelivr\.net;/,
      );
      expect(doc).toMatch(
        /connect-src https:\/\/cdn\.jsdelivr\.net https:\/\/storage\.googleapis\.com;/,
      );
      expect(doc).toContain('worker-src blob:;');
    }
  });

  it('threejs loads the pinned CDN script, allows only that origin in the CSP, and wraps the snippet in a provided container + <script>', () => {
    const jsSnippet = "THREE.foo(); document.getElementById('art-piece-container');";
    const doc = buildArtPieceSandboxDocument(jsSnippet, 'threejs');
    expect(doc).toContain('<script src="https://cdn.jsdelivr.net/npm/three@0.160.0');
    expect(doc).toMatch(
      /script-src 'unsafe-inline' 'wasm-unsafe-eval' https:\/\/cdn\.jsdelivr\.net;/,
    );
    expect(doc).toContain('id="art-piece-container"');
    expect(doc).toContain(`<script>${jsSnippet}</script>`);
  });

  it("aframe loads the pinned CDN script, allows only that origin plus 'unsafe-eval' in the CSP, and places the snippet directly", () => {
    // 'unsafe-eval' regression for #236: A-Frame's own system
    // initialization calls a dynamic eval/Function-constructor
    // internally -- without this, every scene threw "a[e] is not a
    // constructor" from deep inside aframe.min.js, a CSP-blocked-eval
    // failure that looked like a library bug. Confirmed live in
    // production (3/3 failures without, 0/3 with).
    const scene = '<a-scene id="art-piece-scene" embedded><a-box></a-box></a-scene>';
    const doc = buildArtPieceSandboxDocument(scene, 'aframe');
    expect(doc).toContain('<script src="https://cdn.jsdelivr.net/npm/aframe@1.4.2');
    expect(doc).toMatch(
      /script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https:\/\/cdn\.jsdelivr\.net;/,
    );
    expect(doc).toContain(scene);
  });

  it("threejs's CSP does not grant 'unsafe-eval' -- only A-Frame needs it", () => {
    const doc = buildArtPieceSandboxDocument('THREE.foo();', 'threejs');
    expect(doc).not.toMatch(/'unsafe-eval'/);
  });

  it('#455: enabling hand steering loads the pinned MediaPipe vision bundle and gesture-recognizer model', () => {
    const doc = buildArtPieceSandboxDocument('THREE.foo();', 'threejs');
    expect(doc).toContain("MEDIAPIPE_VISION_VERSION = '1.0.1'");
    expect(doc).toContain('/vision_bundle.mjs');
    expect(doc).toContain('cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@');
    expect(doc).toContain(
      'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
    );
    expect(doc).toContain('ensureHandTracking()');
  });

  it('#455: steer-signal and the real hand-tracking loop share one bounded-pose path', () => {
    const doc = buildArtPieceSandboxDocument('THREE.foo();', 'threejs');
    expect(doc).toContain('function applySteerDelta(dx, dy, dz)');
    expect(doc).toContain('applySteerDelta(data.dx, data.dy, data.dz)');
    expect(doc).toContain('applySteerDelta(dx, dy, dz)');
  });

  it("#455: the trusted wrapper's A-Frame auto-camera-registration is guarded by pieceLibrary === 'aframe'", () => {
    // The listener script's source text is identical for every library
    // (it's one shared template) -- what actually differs at runtime is
    // the `pieceLibrary === 'aframe'` guard around this block, since
    // A-Frame's own system prompt forbids the generated markup from ever
    // calling window.__registerArtPieceCamera itself (unlike Three.js).
    const doc = buildArtPieceSandboxDocument(
      '<a-scene id="art-piece-scene" embedded></a-scene>',
      'aframe',
    );
    expect(doc).toContain("pieceLibrary === 'aframe'");
    expect(doc).toContain("document.querySelector('a-scene')");
    expect(doc).toContain('sceneEl.camera');
    expect(doc).toContain('window.__registerArtPieceCamera');
  });

  it("#480: A-Frame auto-registration moves the wrapping entity (not the camera element's own local object3D) when the camera is nested", () => {
    // Regression for #480: sceneEl.camera.position is the raw THREE.Camera's
    // *local* offset (near (0,0,0), or A-Frame's own default eye-height for
    // a bare <a-camera>) -- never the authored world position. The fix
    // walks up to the camera element's parent and, when that parent isn't
    // <a-scene> itself (i.e. the system prompt's own recommended wrapping-
    // entity pattern), registers *that* entity's object3D instead, since
    // it's the one actually carrying the authored position/rotation.
    const doc = buildArtPieceSandboxDocument(
      '<a-scene id="art-piece-scene" embedded></a-scene>',
      'aframe',
    );
    expect(doc).not.toContain('camObj.position');
    expect(doc).toContain('cameraEl.parentEl');
    expect(doc).toContain("wrappingEl.tagName !== 'A-SCENE'");
    expect(doc).toContain('wrappingEl.object3D');
    expect(doc).toContain('cameraEl.object3D');
  });

  it('the CDN script loads before the listener script, which loads before the snippet, for every library', () => {
    const jsSnippet = 'THREE.foo();';
    const doc = buildArtPieceSandboxDocument(jsSnippet, 'threejs');
    const cdnIndex = doc.indexOf('cdn.jsdelivr.net');
    const listenerIndex = doc.indexOf('addEventListener');
    const snippetIndex = doc.indexOf(jsSnippet);
    expect(cdnIndex).toBeGreaterThan(-1);
    expect(listenerIndex).toBeGreaterThan(cdnIndex);
    expect(snippetIndex).toBeGreaterThan(listenerIndex);
  });
});

describe('parseArtPieceSandboxMessage', () => {
  it('parses a ready message', () => {
    expect(
      parseArtPieceSandboxMessage({ source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'ready' }),
    ).toEqual({ source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'ready' });
  });

  it('parses an error message with its text', () => {
    expect(
      parseArtPieceSandboxMessage({
        source: ART_PIECE_SANDBOX_MESSAGE_SOURCE,
        status: 'error',
        message: 'boom',
      }),
    ).toEqual({ source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'error', message: 'boom' });
  });

  it('falls back to a generic message when an error carries no string message', () => {
    expect(
      parseArtPieceSandboxMessage({ source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'error' }),
    ).toEqual({
      source: ART_PIECE_SANDBOX_MESSAGE_SOURCE,
      status: 'error',
      message: 'Unknown error.',
    });
  });

  it('rejects messages from a different source, unknown status, or non-object data', () => {
    expect(parseArtPieceSandboxMessage({ source: 'something-else', status: 'ready' })).toBeNull();
    expect(
      parseArtPieceSandboxMessage({ source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'other' }),
    ).toBeNull();
    expect(parseArtPieceSandboxMessage('not an object')).toBeNull();
    expect(parseArtPieceSandboxMessage(null)).toBeNull();
    expect(parseArtPieceSandboxMessage(undefined)).toBeNull();
  });
});
