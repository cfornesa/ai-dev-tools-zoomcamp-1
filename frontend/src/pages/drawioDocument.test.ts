import { describe, expect, it } from 'vitest';
import { baseScene } from '../render/testSceneFixtures';
import {
  deleteDrawioObject,
  duplicateDrawioObject,
  hitTestDrawioObjectAt,
  moveDrawioObject,
  resizeDrawioObject,
  rotateDrawioObject,
} from './drawioDocument';

function scene(locked = false) {
  return baseScene({
    documentType: 'drawio',
    drawio: {
      formatVersion: 1,
      layers: [{ id: 'd', name: 'Draw', order: 0, visible: true, locked }],
      objects: [
        {
          id: 'r',
          type: 'rect',
          layerId: 'd',
          parentId: null,
          x: 1,
          y: 2,
          width: 10,
          height: 10,
          fill: '#fff',
          stroke: null,
        },
      ],
    },
  });
}

function objects(result: { scene: { drawio?: unknown } }) {
  return (
    result.scene.drawio as {
      objects: Array<{ id: string; x: number; width: number; rotation?: number }>;
    }
  ).objects;
}

describe('draw.io object mutations', () => {
  it('moves, resizes, duplicates, and deletes only the selected object', () => {
    const moved = moveDrawioObject(scene(), 'r', 3, 4);
    expect(moved.ok && objects(moved)[0].x).toBe(4);
    const resized = resizeDrawioObject(moved.ok ? moved.scene : scene(), 'r', 20, 21);
    expect(resized.ok && objects(resized)[0].width).toBe(20);
    const copied = duplicateDrawioObject(resized.ok ? resized.scene : scene(), 'r');
    expect(copied.ok && objects(copied)).toHaveLength(2);
    const deleted = deleteDrawioObject(copied.ok ? copied.scene : scene(), 'r');
    expect(deleted.ok && objects(deleted)[0].id).toBe('r-copy');
  });

  it('rejects mutation in hidden/locked layers', () => {
    expect(moveDrawioObject(scene(true), 'r', 1, 1).ok).toBe(false);
  });

  it('rotates a selected object within the supported bounds', () => {
    const rotated = rotateDrawioObject(scene(), 'r', 15);
    expect(rotated.ok && objects(rotated)[0].rotation).toBe(15);
  });

  it('hit-tests only visible supported objects', () => {
    expect(hitTestDrawioObjectAt(scene(), 5, 5)?.id).toBe('r');
    expect(hitTestDrawioObjectAt(scene(), 50, 50)).toBeNull();
  });
});
