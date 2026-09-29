import { describe, expect, it } from 'vitest';

import { generateEditable3dHtml, parseEditable3dHtml } from './codeGrammar3dTabs';
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
