import { describe, expect, it } from 'vitest';

import { appendGenerated2DEdit } from './generated2dManualTools';

describe('generated 2D manual source edits', () => {
  it('appends deterministic Canvas2D edits inside one marked region', () => {
    const once = appendGenerated2DEdit(
      '<canvas id="art-piece-canvas"></canvas>',
      'canvas2d',
      'add-shape',
    );
    const twice = appendGenerated2DEdit(once, 'canvas2d', 'add-line');
    expect(twice).toContain('AUGMENTRART_EDITABLE_START');
    expect(twice.match(/AUGMENTRART_EDITABLE_START/g)).toHaveLength(1);
    expect(twice).toContain('ctx.fillRect(80,80,80,80)');
    expect(twice).toContain('ctx.lineTo(260,180)');
    expect(appendGenerated2DEdit(twice, 'canvas2d', 'add-ellipse')).toContain(
      'ctx.ellipse(120,120,48,32',
    );
  });

  it('inserts SVG elements before the closing tag', () => {
    const edited = appendGenerated2DEdit('<svg id="art-piece-svg"></svg>', 'svg', 'freehand-draw');
    expect(edited).toContain('<path d="M60 180 L100 140 L140 180 L180 140"');
    expect(edited).toContain('<!-- AUGMENTRART_EDITABLE_START -->');
    expect(edited.indexOf('AUGMENTRART_EDITABLE_START')).toBeLessThan(edited.indexOf('</svg>'));
  });
});
