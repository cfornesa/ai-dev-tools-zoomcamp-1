import { describe, expect, it } from 'vitest';

import { buildInkOverlayBlock, injectBeforeBodyEnd, sanitizeInk } from './inkOverlay';

const ink = {
  width: 1280,
  height: 720,
  background: null,
  shapes: [
    {
      id: 'a',
      type: 'path',
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      closed: false,
      fill: null,
      stroke: '#112233',
      strokeWidth: 5,
      opacity: 0.5,
    },
    { id: 'b', type: 'rect', x: 1, y: 2, width: 30, height: 40, fill: '#ff0000', stroke: null },
  ],
};

describe('ink overlay (#776)', () => {
  it('renders every shape into a pointer-transparent svg over the artwork', () => {
    const block = buildInkOverlayBlock(ink);
    expect(block).toContain('id="art-piece-ink-overlay"');
    expect(block).toContain('viewBox="0 0 1280 720"');
    expect(block).toContain('<path d="M10 20 L30 40"');
    expect(block).toContain('<rect x="1" y="2" width="30" height="40" fill="#ff0000"');
    expect(block).toContain('pointer-events:none');
    expect(block).toContain('__artPieceScreenshotExtras');
  });

  it('is empty when there is no usable ink', () => {
    expect(buildInkOverlayBlock(null)).toBe('');
    expect(buildInkOverlayBlock({ width: 10, height: 10, shapes: [] })).toBe('');
    expect(buildInkOverlayBlock('nope')).toBe('');
  });

  it('never lets hostile values reach the markup or script', () => {
    const hostile = {
      width: 100,
      height: 100,
      shapes: [
        {
          id: '"><script>alert(1)</script>',
          type: 'rect',
          x: '</script><script>alert(2)',
          y: 0,
          width: 10,
          height: 10,
          fill: 'red" onload="alert(3)',
          stroke: 'javascript:alert(4)',
        },
        { id: 'p', type: 'unknown' },
      ],
    };
    const block = buildInkOverlayBlock(hostile);
    expect(block).not.toMatch(/alert\(/);
    expect(block).not.toContain('onload');
    expect(block).not.toContain('javascript:');
    expect((block.match(/<script>/g) ?? []).length).toBe(1);
  });

  it('sanitizes down to known shapes and caps sizes', () => {
    const doc = sanitizeInk({
      ...ink,
      shapes: [...ink.shapes, { type: 'path', points: 'x' }, { type: 'wat' }, null],
    });
    expect(doc?.shapes).toHaveLength(2);
  });

  it('injects before the closing body tag', () => {
    expect(injectBeforeBodyEnd('<body>x</body>', '<b/>')).toBe('<body>x<b/>\n</body>');
    expect(injectBeforeBodyEnd('<p>x</p>', '<b/>')).toBe('<p>x</p><b/>');
    expect(injectBeforeBodyEnd('<body></body>', '')).toBe('<body></body>');
  });
});

describe('ink overlay in the sandbox document and ZIP (#776)', () => {
  it('adds the overlay to the sandbox document only when ink exists, keeping the opaque-origin sandbox', async () => {
    const { ART_PIECE_IFRAME_SANDBOX, buildArtPieceSandboxDocument } =
      await import('./artPieceSandbox');
    const source = '<canvas id="art-piece-canvas"></canvas>';
    const plain = buildArtPieceSandboxDocument(source, 'canvas2d');
    const inked = buildArtPieceSandboxDocument(source, 'canvas2d', 'regular', { ink });
    expect(plain).not.toContain('id="art-piece-ink-overlay"');
    expect(inked).toContain('id="art-piece-ink-overlay"');
    expect(inked.indexOf('<svg id="art-piece-ink-overlay"')).toBeGreaterThan(inked.indexOf(source));
    expect(ART_PIECE_IFRAME_SANDBOX).toBe('allow-scripts');
    // Screenshots can ask for the bare artwork (the ink editor's snapshot).
    expect(inked).toContain('includeInk === false');
  });

  it('adds the overlay to the ZIP index.html', async () => {
    const JSZip = (await import('jszip')).default;
    const { generateArtPieceBundle } = await import('./artPieceBundle');
    const blob = await generateArtPieceBundle('svg', '<svg viewBox="0 0 10 10"></svg>', { ink });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const html = await zip.files['index.html']!.async('string');
    expect(html).toContain('id="art-piece-ink-overlay"');
    const without = await generateArtPieceBundle('svg', '<svg viewBox="0 0 10 10"></svg>');
    const plain = await (
      await JSZip.loadAsync(await without.arrayBuffer())
    ).files['index.html']!.async('string');
    expect(plain).not.toContain('art-piece-ink-overlay');
  });
});
