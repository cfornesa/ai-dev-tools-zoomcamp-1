import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { validateScene } from '../validation/scene';
import {
  generateEditableCss,
  generateEditableHtml,
  generateEditableJs,
  isEditableJsUnchanged,
  parseEditableHtmlAndCss,
  parseEditableJs,
} from './codeGrammar';

function baseScene(overrides: Partial<SceneDocument> = {}): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-internal-id-999',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [
      { id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false },
      { id: 'layer-2', name: 'Layer 2', order: 1, visible: true, locked: false },
    ],
    shapes: [
      {
        id: 'shape-1',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: '#ff0000', stroke: null, strokeWidth: 0 },
        radius: 40,
      },
      {
        id: 'shape-2',
        type: 'rect',
        layerId: 'layer-2',
        groupId: null,
        transform: { x: 200, y: 50, scaleX: 1, scaleY: 1, rotation: 15, opacity: 0.5 },
        style: { fill: '#00ff00', stroke: '#000000', strokeWidth: 2 },
        width: 120,
        height: 60,
        cornerRadius: 4,
      },
    ],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
    ...overrides,
  };
}

describe('generateEditableHtml / generateEditableCss: forward direction', () => {
  it('emits one <div> per editable shape with the documented data attributes', () => {
    const html = generateEditableHtml(baseScene());
    expect(html).toContain('<main id="scene-shapes">');
    expect(html).toContain('data-shape-id="shape-1"');
    expect(html).toContain('data-shape-type="circle"');
    expect(html).toContain('data-layer-id="layer-1"');
    expect(html).toContain('data-shape-id="shape-2"');
    expect(html).toContain('data-shape-type="rect"');
  });

  it('marks a hidden/locked shape with the documented class tokens', () => {
    const scene = baseScene();
    (scene.shapes as unknown[])[0] = {
      ...(scene.shapes as any[])[0],
      visible: false,
      locked: true,
    };
    const html = generateEditableHtml(scene);
    expect(html).toMatch(/class="scene-shape circle hidden locked"/);
  });

  it('emits one CSS rule per shape plus one for the canvas', () => {
    const css = generateEditableCss(baseScene());
    expect(css).toContain('#scene-shapes {');
    expect(css).toContain('background-color: #ffffff;');
    expect(css).toContain('#shape-shape-1 {');
    expect(css).toContain('#shape-shape-2 {');
    expect(css).toContain('border-radius: 4px;');
    expect(css).toContain('transform: rotate(15deg) scale(1, 1);');
  });

  it('excludes particleEmitter shapes from the editable HTML/CSS surface', () => {
    const scene = baseScene({
      shapes: [
        ...(baseScene().shapes as unknown[]),
        {
          id: 'emitter-1',
          type: 'particleEmitter',
          layerId: 'layer-1',
          groupId: null,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          style: { fill: '#fff', stroke: null, strokeWidth: 0 },
          rate: 10,
          size: 5,
          lifespan: 2,
          speed: 50,
          palette: ['#ffffff'],
        },
      ],
    });
    const html = generateEditableHtml(scene);
    const css = generateEditableCss(scene);
    expect(html).not.toContain('emitter-1');
    expect(css).not.toContain('emitter-1');
  });

  it('the JS sub-tab documents the Grammar v2 bindings whitelist and round-trips unchanged', () => {
    const js = generateEditableJs(baseScene());
    expect(js).toContain('Grammar v2');
    expect(js).toContain('const bindings = [];');
    expect(isEditableJsUnchanged(js, baseScene())).toBe(true);
    expect(isEditableJsUnchanged(js + '\n// hand edit', baseScene())).toBe(false);
  });

  it('serializes an existing binding into the editable bindings array', () => {
    const scene = baseScene({
      bindings: [
        {
          id: 'binding-1',
          signal: 'indexTipX',
          handTarget: 'primary',
          targetScope: 'shape',
          targetId: 'shape-1',
          targetProperty: 'positionX',
          composition: 'replace',
          mapping: { inMin: 0, inMax: 1, outMin: 0, outMax: 800 },
        },
      ],
    });
    const js = generateEditableJs(scene);
    expect(js).toContain('const bindings = [');
    expect(js).toContain('id: "binding-1"');
    expect(js).toContain('signal: "indexTipX"');
    expect(js).toContain('mapping: { inMin: 0, inMax: 1, outMin: 0, outMax: 800 }');
  });
});

describe('parseEditableJs: Grammar v2 reverse direction (bindings)', () => {
  it('round-trips unchanged: regenerated JS re-saved produces no scene mutation', () => {
    const scene = baseScene({
      bindings: [
        {
          id: 'binding-1',
          signal: 'palmY',
          handTarget: 'either',
          targetScope: 'scene',
          targetId: null,
          targetProperty: 'globalForce',
          composition: 'replace',
          smoothing: 0.5,
        },
      ],
    });
    const js = generateEditableJs(scene);
    const result = parseEditableJs(js, scene);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validateScene(result.scene).valid).toBe(true);
    expect(generateEditableJs(result.scene)).toBe(js);
  });

  it('adds a new binding via the JS sub-tab', () => {
    const scene = baseScene();
    const js = generateEditableJs(scene).replace(
      'const bindings = [];',
      [
        'const bindings = [',
        '  {',
        '    id: "binding-new",',
        '    signal: "pinchStrength",',
        '    handTarget: "right",',
        '    targetScope: "group",',
        '    targetId: "group-1",',
        '    targetProperty: "scaleX",',
        '    composition: "replace"',
        '  }',
        '];',
      ].join('\n'),
    );
    const result = parseEditableJs(js, scene);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bindings = result.scene.bindings as any[];
    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({
      id: 'binding-new',
      signal: 'pinchStrength',
      handTarget: 'right',
      targetScope: 'group',
      targetId: 'group-1',
      targetProperty: 'scaleX',
      composition: 'replace',
    });
  });

  it('removes a binding via the JS sub-tab', () => {
    const scene = baseScene({
      bindings: [
        {
          id: 'binding-1',
          signal: 'palmY',
          handTarget: 'either',
          targetScope: 'scene',
          targetId: null,
          targetProperty: 'globalForce',
          composition: 'replace',
        },
      ],
    });
    const js = generateEditableJs(scene).replace(
      /const bindings = \[[\s\S]*?\];/,
      'const bindings = [];',
    );
    const result = parseEditableJs(js, scene);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scene.bindings).toEqual([]);
  });

  it('rejects an out-of-whitelist field on a binding with a specific, actionable error', () => {
    const scene = baseScene();
    const js = generateEditableJs(scene).replace(
      'const bindings = [];',
      [
        'const bindings = [',
        '  {',
        '    id: "binding-new",',
        '    signal: "pinchStrength",',
        '    handTarget: "right",',
        '    targetScope: "scene",',
        '    targetId: null,',
        '    targetProperty: "scaleX",',
        '    composition: "replace",',
        '    evalCode: "alert(1)"',
        '  }',
        '];',
      ].join('\n'),
    );
    const result = parseEditableJs(js, scene);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/unsupported field.*"evalCode"/);
  });

  it('rejects an edit outside the bindings array (the generated runtime code)', () => {
    const scene = baseScene();
    const js = generateEditableJs(scene) + '\n// hand edit outside the markers';
    const result = parseEditableJs(js, scene);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/not part of the supported grammar yet/);
  });

  it('rejects an invalid composition value', () => {
    const scene = baseScene();
    const js = generateEditableJs(scene).replace(
      'const bindings = [];',
      [
        'const bindings = [',
        '  {',
        '    id: "binding-new",',
        '    signal: "pinchStrength",',
        '    handTarget: "right",',
        '    targetScope: "scene",',
        '    targetId: null,',
        '    targetProperty: "scaleX",',
        '    composition: "add"',
        '  }',
        '];',
      ].join('\n'),
    );
    const result = parseEditableJs(js, scene);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/"composition" must be "replace"/);
  });

  it('never executes hand-edited JS: a binding array with a function-call-shaped value is rejected, not run', () => {
    const scene = baseScene();
    const js = generateEditableJs(scene).replace(
      'const bindings = [];',
      'const bindings = [ { id: alert(1), signal: "pinchStrength" } ];',
    );
    const result = parseEditableJs(js, scene);
    expect(result.ok).toBe(false);
  });
});

describe('parseEditableHtmlAndCss: reverse direction', () => {
  it('round-trips unchanged: regenerated HTML/CSS re-saved produces no scene mutation', () => {
    const scene = baseScene();
    const html = generateEditableHtml(scene);
    const css = generateEditableCss(scene);
    const result = parseEditableHtmlAndCss(html, css, scene);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validateScene(result.scene).valid).toBe(true);
    // Functional round-trip: regenerating HTML/CSS from the parsed result
    // must match the original generated text exactly (nothing drifted),
    // even though the parsed scene object may fill in previously-absent
    // optional fields (e.g. `visible`/`locked`) with their documented
    // defaults -- see schema/scene.schema.json's doc comments on those
    // fields for why an absent value and an explicit default value are
    // equivalent, not a real change.
    expect(generateEditableHtml(result.scene)).toBe(html);
    expect(generateEditableCss(result.scene)).toBe(css);
  });

  it('applies a position/color edit back onto the scene', () => {
    const scene = baseScene();
    const html = generateEditableHtml(scene);
    const css = generateEditableCss(scene)
      .replace('left: 100px;', 'left: 250px;')
      .replace('background-color: #ff0000;', 'background-color: #0000ff;');
    const result = parseEditableHtmlAndCss(html, css, scene);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const shape = (result.scene.shapes as any[]).find((s) => s.id === 'shape-1');
    expect(shape.transform.x).toBe(250);
    expect(shape.style.fill).toBe('#0000ff');
    expect(validateScene(result.scene).valid).toBe(true);
  });

  it('reorders shapes when the HTML div order changes', () => {
    const scene = baseScene();
    const html = generateEditableHtml(scene);
    const reordered = html
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .reverse()
      .join('\n')
      // reverse() also flips <main>/</main> tags -- put them back in place
      .replace('</main>', '')
      .replace('<main id="scene-shapes">', '');
    const wrapped = `<main id="scene-shapes">\n${reordered}\n</main>`;
    const css = generateEditableCss(scene);
    const result = parseEditableHtmlAndCss(wrapped, css, scene);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.scene.shapes as any[])[0].id).toBe('shape-2');
    expect((result.scene.shapes as any[])[1].id).toBe('shape-1');
  });

  it('rejects an out-of-grammar edit: removing a shape from the HTML', () => {
    const scene = baseScene();
    const html = generateEditableHtml(scene).replace(
      /\s*<div data-shape-id="shape-2".*?<\/div>/s,
      '',
    );
    const css = generateEditableCss(scene);
    const result = parseEditableHtmlAndCss(html, css, scene);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/missing.*shape-2|shapes cannot be removed/i);
  });

  it('rejects an out-of-grammar edit: changing a shape type', () => {
    const scene = baseScene();
    const html = generateEditableHtml(scene)
      .replace('data-shape-type="rect"', 'data-shape-type="line"')
      .replace('class="scene-shape rect"', 'class="scene-shape line"');
    const css = generateEditableCss(scene);
    const result = parseEditableHtmlAndCss(html, css, scene);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/type cannot change/i);
  });

  it('rejects an unsupported CSS property with a specific, actionable error', () => {
    const scene = baseScene();
    const html = generateEditableHtml(scene);
    const css = generateEditableCss(scene) + '\n#shape-shape-1 { color: red; }';
    const result = parseEditableHtmlAndCss(html, css, scene);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/unsupported property "color"/);
  });

  it('rejects an unsupported CSS selector', () => {
    const scene = baseScene();
    const html = generateEditableHtml(scene);
    const css = generateEditableCss(scene) + '\n.some-class { opacity: 1; }';
    const result = parseEditableHtmlAndCss(html, css, scene);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/Unsupported CSS selector/);
  });

  it('rejects an unrecognized class token on a shape div', () => {
    const scene = baseScene();
    const html = generateEditableHtml(scene).replace(
      'class="scene-shape circle"',
      'class="scene-shape circle sparkly"',
    );
    const css = generateEditableCss(scene);
    const result = parseEditableHtmlAndCss(html, css, scene);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/unrecognized class "sparkly"/);
  });

  it('rejects a non-div element inside <main id="scene-shapes">', () => {
    const scene = baseScene();
    const html = generateEditableHtml(scene).replace('</main>', '  <span>injected</span>\n</main>');
    const css = generateEditableCss(scene);
    const result = parseEditableHtmlAndCss(html, css, scene);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/only <div> shape elements are supported/);
  });

  it('rejects an attempt to change layer/group membership via the Code tab', () => {
    const scene = baseScene();
    const html = generateEditableHtml(scene).replace(
      'data-layer-id="layer-1"',
      'data-layer-id="layer-2"',
    );
    const css = generateEditableCss(scene);
    const result = parseEditableHtmlAndCss(html, css, scene);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/data-layer-id cannot be changed/);
  });

  it('preserves particleEmitter shapes unchanged across a Code-tab save', () => {
    const emitter = {
      id: 'emitter-1',
      type: 'particleEmitter',
      layerId: 'layer-1',
      groupId: null,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: '#fff', stroke: null, strokeWidth: 0 },
      rate: 10,
      size: 5,
      lifespan: 2,
      speed: 50,
      palette: ['#ffffff'],
    };
    const scene = baseScene({ shapes: [...(baseScene().shapes as unknown[]), emitter] });
    const html = generateEditableHtml(scene);
    const css = generateEditableCss(scene);
    const result = parseEditableHtmlAndCss(html, css, scene);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.scene.shapes as any[]).find((s) => s.id === 'emitter-1')).toEqual(emitter);
  });
});
