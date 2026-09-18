import { describe, expect, it } from 'vitest';

import { buildArtPieceSandboxDocument } from './artPieceSandbox';

describe('regular art-piece engine adapters', () => {
  it('boots p5 instance-mode sketches through the trusted mount wrapper', () => {
    const html = buildArtPieceSandboxDocument(
      'window.sketch = (p) => { p.setup = () => {}; };',
      'p5js',
    );
    expect(html).toContain('p5@1.9.0/lib/p5.min.js');
    expect(html).toContain('new window.p5(window.sketch, mount)');
    expect(html).toContain('id="art-piece-container"');
  });

  it.each(['c2js', 'c2js-interactive'] as const)(
    'boots %s through the shared C2 runtime object',
    (library) => {
      const html = buildArtPieceSandboxDocument(
        'window.sketch = (runtime) => { runtime.startFrame(() => {}); };',
        library,
      );
      expect(html).toContain('c2.js@1.0.9/dist/c2.min.js');
      expect(html).toContain('id="c2-canvas"');
      expect(html).toContain(
        'window.sketch({ c2: window.c2, canvas: canvas, startFrame: startFrame })',
      );
    },
  );
});
