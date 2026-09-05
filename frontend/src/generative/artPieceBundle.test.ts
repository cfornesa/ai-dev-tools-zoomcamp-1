import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ArtPieceBundleError,
  generateArtPieceBundle,
  triggerArtPieceBundleDownload,
} from './artPieceBundle';

const CANVAS2D_CODE =
  '<canvas id="art-piece-canvas"></canvas><script>document.title = "hi";</script>';
const SVG_CODE = '<svg id="art-piece-svg"></svg>';
const THREEJS_CODE = "THREE.foo(); document.getElementById('art-piece-container');";
const AFRAME_CODE = '<a-scene id="art-piece-scene" embedded><a-box></a-box></a-scene>';

const RUNTIME_BYTES = new TextEncoder().encode('/* fake three.js runtime */').buffer;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => RUNTIME_BYTES,
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('generateArtPieceBundle', () => {
  // JSZip's `file()` auto-creates an explicit directory entry for each
  // path segment of a nested file by default -- these tests assert on
  // the actual *files* present (`.dir === false`), not the directory
  // marker entries, which are harmless and not this module's concern.
  function fileNames(zip: JSZip): string[] {
    return Object.keys(zip.files)
      .filter((name) => !zip.files[name].dir)
      .sort();
  }

  it('canvas2d: bundles README, styles, and index.html with the code inline -- no scripts/ or runtime/', async () => {
    const blob = await generateArtPieceBundle('canvas2d', CANVAS2D_CODE);
    const zip = await JSZip.loadAsync(blob);
    expect(fileNames(zip)).toEqual(['README.txt', 'index.html', 'styles/piece.css']);

    const html = await zip.files['index.html'].async('string');
    expect(html).toContain(CANVAS2D_CODE);
    expect(html).toContain('styles/piece.css');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('svg: same shape as canvas2d -- markup inline, no scripts/ or runtime/', async () => {
    const blob = await generateArtPieceBundle('svg', SVG_CODE);
    const zip = await JSZip.loadAsync(blob);
    expect(fileNames(zip)).toEqual(['README.txt', 'index.html', 'styles/piece.css']);
    expect(await zip.files['index.html'].async('string')).toContain(SVG_CODE);
  });

  it('adds viewer controls without a recursive download control', async () => {
    const blob = await generateArtPieceBundle('canvas2d', CANVAS2D_CODE, {
      capabilities: { screenshot: true, sound: true, hand_steering: true, camera_view: true },
      mode: 'full',
    });
    const zip = await JSZip.loadAsync(blob);
    const html = await zip.files['index.html'].async('string');
    expect(html).toContain('data-action="screenshot"');
    expect(html).toContain('data-action="sound"');
    expect(html).toContain('data-action="camera"');
    expect(html).toContain('data-action="hand"');
    expect(html).not.toContain('Download full piece');
    expect(html).not.toContain('data-action="download"');
  });

  it('non-camera mode removes camera/hand UI, drops an external mediapipe script tag, and installs the device-isolation guard -- without touching the rest of the source', async () => {
    const source =
      '<script src="https://cdn.example/mediapipe.js"></script><script>navigator.mediaDevices.getUserMedia({video:true});</script>';
    const blob = await generateArtPieceBundle('canvas2d', source, {
      capabilities: { screenshot: true, camera_view: true, hand_steering: true },
      mode: 'non-camera',
    });
    const zip = await JSZip.loadAsync(blob);
    const html = await zip.files['index.html'].async('string');
    // The only markup this mode ever removes is an externally-referenced
    // mediapipe/camera <script> tag -- never a bare JS identifier or
    // call. The generated getUserMedia call itself is left completely
    // intact; `guardedGetUserMedia` runtime override below is what
    // actually stops it, not text surgery on the call site.
    expect(html).not.toContain('mediapipe.js');
    expect(html).toContain('navigator.mediaDevices.getUserMedia({video:true});');
    expect(html).toContain('guardedGetUserMedia');
    expect(html).not.toContain('data-action="camera"');
    expect(html).not.toContain('data-action="hand"');
    expect(html).toContain('data-action="screenshot"');
  });

  it('never mangles an ordinary Three.js `camera` variable -- the exact regression this issue fixes', async () => {
    // Applying the old blanket word-replacement to this exact line
    // produced `var non-camera = ...`, a SyntaxError at parse time.
    const source =
      'var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100); camera.position.set(0, 0, 5);';
    const blob = await generateArtPieceBundle('threejs', source, { mode: 'non-camera' });
    const zip = await JSZip.loadAsync(blob);
    expect(await zip.files['scripts/piece.js'].async('string')).toBe(source);
  });

  it('the device-isolation guard loads before the vendored runtime and before scripts/piece.js', async () => {
    const blob = await generateArtPieceBundle('threejs', THREEJS_CODE, { mode: 'non-camera' });
    const zip = await JSZip.loadAsync(blob);
    const html = await zip.files['index.html'].async('string');
    const guardIndex = html.indexOf('guardedGetUserMedia');
    const runtimeIndex = html.indexOf('runtime/three.min.js');
    const pieceScriptIndex = html.indexOf('scripts/piece.js');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(runtimeIndex);
    expect(guardIndex).toBeLessThan(pieceScriptIndex);
  });

  it('full mode never installs the device-isolation guard', async () => {
    const blob = await generateArtPieceBundle('canvas2d', CANVAS2D_CODE, { mode: 'full' });
    const zip = await JSZip.loadAsync(blob);
    const html = await zip.files['index.html'].async('string');
    expect(html).not.toContain('guardedGetUserMedia');
  });

  it('threejs: splits the code into scripts/piece.js, provides a container div, and vendors the runtime', async () => {
    const blob = await generateArtPieceBundle('threejs', THREEJS_CODE);
    const zip = await JSZip.loadAsync(blob);
    expect(fileNames(zip)).toEqual([
      'README.txt',
      'index.html',
      'runtime/three.min.js',
      'scripts/piece.js',
      'styles/piece.css',
    ]);

    expect(await zip.files['scripts/piece.js'].async('string')).toBe(THREEJS_CODE);
    const html = await zip.files['index.html'].async('string');
    expect(html).toContain('id="art-piece-container"');
    expect(html).toContain('scripts/piece.js');
    expect(html).toContain('runtime/three.min.js');
    expect(html).not.toContain('cdn.jsdelivr.net');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('cdn.jsdelivr.net/npm/three@0.160.0'),
    );
  });

  it('aframe: markup inline, no scripts/, but the runtime is vendored', async () => {
    const blob = await generateArtPieceBundle('aframe', AFRAME_CODE);
    const zip = await JSZip.loadAsync(blob);
    expect(fileNames(zip)).toEqual([
      'README.txt',
      'index.html',
      'runtime/aframe.min.js',
      'styles/piece.css',
    ]);
    const html = await zip.files['index.html'].async('string');
    expect(html).toContain(AFRAME_CODE);
    expect(html).toContain('runtime/aframe.min.js');
    expect(html).not.toContain('cdn.jsdelivr.net');
  });

  it('the vendored runtime file is byte-identical to the fetched response', async () => {
    const blob = await generateArtPieceBundle('threejs', THREEJS_CODE);
    const zip = await JSZip.loadAsync(blob);
    const vendored = await zip.files['runtime/three.min.js'].async('arraybuffer');
    expect(new Uint8Array(vendored)).toEqual(new Uint8Array(RUNTIME_BYTES));
  });

  it('rejects with ArtPieceBundleError, without producing a bundle, if the runtime fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    await expect(generateArtPieceBundle('threejs', THREEJS_CODE)).rejects.toThrow(
      ArtPieceBundleError,
    );
  });

  it('rejects with ArtPieceBundleError if the runtime fetch returns a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, arrayBuffer: async () => RUNTIME_BYTES })),
    );
    await expect(generateArtPieceBundle('aframe', AFRAME_CODE)).rejects.toThrow(
      ArtPieceBundleError,
    );
  });

  it("every actual file entry (excluding JSZip's own directory markers) has dir: false", async () => {
    const blob = await generateArtPieceBundle('threejs', THREEJS_CODE);
    const zip = await JSZip.loadAsync(blob);
    for (const name of fileNames(zip)) {
      expect(zip.files[name].dir).toBe(false);
    }
  });
});

describe('triggerArtPieceBundleDownload', () => {
  it('creates an object URL, clicks a synthetic download link, and revokes the URL', () => {
    const createObjectURL = vi.fn(() => 'blob:fake-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    triggerArtPieceBundleDownload(new Blob(['x']), 'art-piece.zip');

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });
});
