import { describe, expect, it } from 'vitest';

import {
  generateEditable3dCss,
  generateEditable3dHtml,
  generateEditable3dJs,
  parseEditable3dCss,
  parseEditable3dHtml,
  parseEditable3dJs,
} from './codeGrammar3dTabs';
import type { Scene3DDocument } from '../pages/scene3dTypes';

function scene(): Scene3DDocument {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: 'scene-1',
    scene: { backgroundColor: '#101010' },
    camera: {
      position: { x: 0, y: 2, z: 8 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    groups: [
      {
        id: 'group-a',
        name: 'A',
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        visible: true,
        locked: false,
      },
    ],
    objects: [
      {
        id: 'box-1',
        type: 'box',
        groupId: 'group-a',
        transform: {
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        material: { color: '#ff0000' },
        visible: true,
        width: 1,
        height: 1,
        depth: 1,
      },
      {
        id: 'sphere-1',
        type: 'sphere',
        groupId: null,
        transform: {
          position: { x: 4, y: 5, z: 6 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        material: { color: '#00ff00' },
        visible: true,
        radius: 1,
      },
    ],
    lights: [{ id: 'light-1', type: 'ambient', color: '#ffffff', intensity: 1 }],
    randomness: { seed: 1, enabled: false },
  };
}

describe('3D HTML code grammar', () => {
  it('round-trips an unmodified scene', () => {
    const original = scene();
    const result = parseEditable3dHtml(generateEditable3dHtml(original), original);
    expect(result).toEqual({ ok: true, scene: original });
  });

  it('applies an object reorder without changing non-structural fields', () => {
    const original = scene();
    const lines = generateEditable3dHtml(original).split('\n');
    const boxLine = lines.findIndex((line) => line.includes('data-object-id="box-1"'));
    const sphereLine = lines.findIndex((line) => line.includes('data-object-id="sphere-1"'));
    [lines[boxLine], lines[sphereLine]] = [lines[sphereLine], lines[boxLine]];
    const html = lines.join('\n');
    const result = parseEditable3dHtml(html, original);
    expect(result.ok).toBe(true);
  });

  it('applies a regroup edit', () => {
    const original = scene();
    const html = generateEditable3dHtml(original).replace(
      'data-object-id="sphere-1" data-object-type="sphere"',
      'data-object-id="sphere-1" data-object-type="sphere" data-parent-group="group-a"',
    );
    const result = parseEditable3dHtml(html, original);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.scene.objects.find((object) => object.id === 'sphere-1')?.groupId).toBe(
        'group-a',
      );
  });

  it('rejects add, remove, and retype attempts', () => {
    const original = scene();
    const generated = generateEditable3dHtml(original);
    expect(
      parseEditable3dHtml(
        generated.replace(
          '</main>',
          '  <div data-object-id="new" data-object-type="box"></div>\n</main>',
        ),
        original,
      ).ok,
    ).toBe(false);
    expect(
      parseEditable3dHtml(generated.replace(/  <div data-object-id="box-1"[^\n]+\n/, ''), original)
        .ok,
    ).toBe(false);
    expect(
      parseEditable3dHtml(
        generated.replace('data-object-type="box"', 'data-object-type="sphere"'),
        original,
      ).ok,
    ).toBe(false);
  });
});

describe('3D CSS code grammar', () => {
  it('round-trips an unmodified scene', () => {
    const original = scene();
    const result = parseEditable3dCss(generateEditable3dCss(original), original);
    expect(result).toEqual({ ok: true, scene: original });
  });

  it('updates one transform while preserving the rest of the scene', () => {
    const original = scene();
    const css = generateEditable3dCss(original).replace('--position-x: 1;', '--position-x: 9;');
    const result = parseEditable3dCss(css, original);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scene.objects[0].transform.position.x).toBe(9);
      expect(result.scene.objects[1]).toEqual(original.objects[1]);
      expect(result.scene.objects[0].material).toEqual(original.objects[0].material);
    }
  });

  it('updates a material and light field', () => {
    const original = scene();
    const css = generateEditable3dCss(original)
      .replace('--material-color: #ff0000;', '--material-color: #0000ff;')
      .replace('--intensity: 1;', '--intensity: 2;');
    const result = parseEditable3dCss(css, original);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scene.objects[0].material.color).toBe('#0000ff');
      expect(result.scene.lights[0].intensity).toBe(2);
    }
  });

  it('rejects out-of-range opacity and intensity values with line errors', () => {
    const original = scene();
    const css = generateEditable3dCss(original)
      .replace('--opacity: 1;', '--opacity: 2;')
      .replace('--intensity: 1;', '--intensity: 101;');
    const result = parseEditable3dCss(css, original);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.every((error) => error.startsWith('Line '))).toBe(true);
  });
});

describe('3D JS code grammar', () => {
  it('round-trips camera and absent renderer configuration', () => {
    const original = scene();
    const result = parseEditable3dJs(generateEditable3dJs(original), original);
    expect(result).toEqual({ ok: true, scene: original });
  });

  it('updates camera and renderer values without touching scene objects', () => {
    const original = scene();
    const source = generateEditable3dJs({ ...original, renderer: { preferred: 'threejs' } })
      .replace('fov: 50', 'fov: 60')
      .replace("preferred: 'threejs'", "preferred: 'aframe'");
    const result = parseEditable3dJs(source, original);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scene.camera.fov).toBe(60);
      expect(result.scene.renderer).toEqual({ preferred: 'aframe' });
      expect(result.scene.objects).toEqual(original.objects);
      expect(result.scene.lights).toEqual(original.lights);
      expect(result.scene.scene).toEqual(original.scene);
    }
  });

  it('rejects out-of-bounds camera values and unsupported renderers', () => {
    const original = scene();
    const source = generateEditable3dJs(original)
      .replace('fov: 50', 'fov: 180')
      .replace('near: 0.1', 'near: 0')
      .replace('far: 1000', "far: 1000, renderer: { preferred: 'babylon' }");
    const result = parseEditable3dJs(source, original);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.every((error) => error.startsWith('Line '))).toBe(true);
  });

  it('rejects edits outside the sentinel block', () => {
    const original = scene();
    const source = generateEditable3dJs(original).replace(JS_FOOTER_FOR_TEST, 'changed');
    const result = parseEditable3dJs(source, original);
    expect(result.ok).toBe(false);
  });
});

const JS_FOOTER_FOR_TEST = '// End Scene3D camera and renderer configuration';
