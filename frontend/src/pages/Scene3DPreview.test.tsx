import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Scene3DPreview from './Scene3DPreview';
import type { Scene3DDocument } from './scene3dTypes';

function baseScene(overrides: Partial<Scene3DDocument> = {}): Scene3DDocument {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: 'scene3d-test',
    scene: { backgroundColor: '#101018' },
    camera: {
      position: { x: 0, y: 0, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    lights: [{ id: 'sun', type: 'ambient', color: '#ffffff', intensity: 1 }],
    groups: [],
    objects: [
      {
        id: 'obj-1',
        type: 'box',
        groupId: null,
        transform: {
          position: { x: 0, y: 0, z: 0 },
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
    ],
    randomness: { seed: 1, enabled: false },
    ...overrides,
  };
}

/**
 * Issue #244: jsdom (this project's test environment) never implements a
 * real WebGL context -- `HTMLCanvasElement.getContext('webgl2', ...)`
 * always returns `null` here, so `THREE.WebGLRenderer`'s constructor
 * always throws in these tests (verified directly against this exact
 * three.js version before writing this file). That's a genuine, valid
 * runtime path this component must handle gracefully for real users too
 * (a browser/device without WebGL support), not just a test-environment
 * artifact -- see Scene3DPreview.tsx's module docstring. These tests
 * therefore exercise the fallback branch; `render/threeSceneBuilder.test.ts`
 * covers the actual Three.js scene-graph construction (camera, lights,
 * objects, groups, materials) with real Three.js objects, independent of
 * any renderer/canvas.
 */
describe('Scene3DPreview', () => {
  it('falls back to a clear, non-crashing message when WebGL cannot be created', () => {
    render(<Scene3DPreview scene={baseScene()} />);

    const fallback = screen.getByTestId('scene3d-preview-unavailable');
    expect(fallback).toHaveTextContent("3D preview isn't available in this browser.");
    expect(fallback).toHaveTextContent('1 object(s), 1 light(s), 0 group(s)');
  });

  it('reflects an empty scene cleanly, not as an error', () => {
    render(<Scene3DPreview scene={baseScene({ objects: [], lights: [], groups: [] })} />);

    const fallback = screen.getByTestId('scene3d-preview-unavailable');
    expect(fallback).toHaveTextContent('0 object(s), 0 light(s), 0 group(s)');
  });

  it('updates the reflected scene summary when the scene prop changes', () => {
    const { rerender } = render(<Scene3DPreview scene={baseScene()} />);
    expect(screen.getByTestId('scene3d-preview-unavailable')).toHaveTextContent(
      '1 object(s), 1 light(s), 0 group(s)',
    );

    rerender(<Scene3DPreview scene={baseScene({ objects: [], lights: [], groups: [] })} />);

    expect(screen.getByTestId('scene3d-preview-unavailable')).toHaveTextContent(
      '0 object(s), 0 light(s), 0 group(s)',
    );
  });
});
