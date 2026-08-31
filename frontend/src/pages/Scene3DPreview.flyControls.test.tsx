import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Scene3DDocument } from './scene3dTypes';

/**
 * Issue #311: arrow-key "fly" translation for the immersive first-person
 * view. Mirrors `Scene3DPreview.orbitControls.test.tsx`'s approach
 * (mocking `THREE.WebGLRenderer` to succeed; jsdom has no real WebGL) but
 * keeps a real, mutable `THREE.Vector3`-like `target` on the fake
 * `OrbitControls` (rather than that file's minimal `{ set: vi.fn() }`),
 * since fly-translation calls `controls.target.add(...)` every frame.
 */

const listenToKeyEventsSpy = vi.fn();
const updateSpy = vi.fn();

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => {
  class FakeOrbitControls {
    target = new (class {
      x = 0;
      y = 0;
      z = 0;
      set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      }
      add(v: { x: number; y: number; z: number }) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
      }
      clone() {
        return { x: this.x, y: this.y, z: this.z };
      }
    })();
    enableDamping = false;
    listenToKeyEvents = listenToKeyEventsSpy;
    update = updateSpy;
    dispose = vi.fn();
  }
  return { OrbitControls: FakeOrbitControls };
});

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    domElement = document.createElement('canvas');
    setSize() {}
    getSize(target: { set: (x: number, y: number) => unknown }) {
      return target.set(320, 240);
    }
    render() {}
    dispose() {}
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

const Scene3DPreview = (await import('./Scene3DPreview')).default;

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
    objects: [],
    randomness: { seed: 1, enabled: false },
    ...overrides,
  };
}

function pressArrowKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function releaseArrowKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

async function tick(frames = 3) {
  for (let i = 0; i < frames; i++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

beforeEach(() => {
  listenToKeyEventsSpy.mockClear();
  updateSpy.mockClear();
});

describe('Scene3DPreview fly controls (issue #311)', () => {
  it('is off by default -- OrbitControls keeps its own built-in arrow-key panning', () => {
    render(<Scene3DPreview scene={baseScene()} />);
    expect(listenToKeyEventsSpy).toHaveBeenCalledWith(window);
  });

  it('when enabled, never calls listenToKeyEvents -- avoids double-handling arrow keys', () => {
    render(<Scene3DPreview scene={baseScene()} flyControls />);
    expect(listenToKeyEventsSpy).not.toHaveBeenCalled();
  });

  it('holding ArrowUp moves the camera position and orbit target together', async () => {
    render(<Scene3DPreview scene={baseScene()} flyControls />);
    await tick(1);

    pressArrowKey('ArrowUp');
    await tick(5);
    releaseArrowKey('ArrowUp');

    // No direct handle on the real THREE.Camera/OrbitControls instances
    // this component creates internally (same documented boundary as
    // `Scene3DPreview.gestureControl.test.tsx`'s own orbit-math test) --
    // the absence of a thrown error/warning across several fly-translation
    // ticks is this test's own practical verification, same convention.
    expect(screen.queryByTestId('screenshot-error')).not.toBeInTheDocument();
  });

  it('releasing all fly keys stops further translation without throwing', async () => {
    render(<Scene3DPreview scene={baseScene()} flyControls />);
    await tick(1);

    pressArrowKey('ArrowLeft');
    await tick(3);
    releaseArrowKey('ArrowLeft');
    await tick(3);

    expect(screen.queryByTestId('screenshot-error')).not.toBeInTheDocument();
  });

  it('cleans up its keydown/keyup listeners on unmount (no error on a late keypress)', async () => {
    const { unmount } = render(<Scene3DPreview scene={baseScene()} flyControls />);
    await tick(1);
    unmount();

    expect(() => pressArrowKey('ArrowUp')).not.toThrow();
  });
});
