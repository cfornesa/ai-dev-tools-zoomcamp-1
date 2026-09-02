import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob } from '../export/downloadBlob';
import type { Scene3DDocument } from './scene3dTypes';

/**
 * Issue #286: "Take screenshot" in the shared `Scene3DPreview.tsx`.
 * Mirrors `Scene3DPreview.orbitControls.test.tsx`'s approach of mocking
 * `THREE.WebGLRenderer` to succeed (jsdom has no real WebGL) rather than
 * faking the whole component away.
 */

vi.mock('../export/downloadBlob');
const mockedDownloadBlob = vi.mocked(downloadBlob);

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => {
  class FakeOrbitControls {
    target = { set: vi.fn() };
    enableDamping = false;
    listenToKeyEvents = vi.fn();
    update = vi.fn();
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

describe('Scene3DPreview "Take screenshot" (issue #286)', () => {
  beforeEach(() => {
    mockedDownloadBlob.mockClear();
  });

  it('shows the button by default and downloads a PNG named after the given base name', async () => {
    render(<Scene3DPreview scene={baseScene()} screenshotBaseName="My 3D scene" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Take screenshot' }),
    );

    await waitFor(() => expect(mockedDownloadBlob).toHaveBeenCalledTimes(1));
    const [blob, filename] = mockedDownloadBlob.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(filename).toMatch(/^my-3d-scene-screenshot-\d+\.png$/);
  });

  it('falls back to the scene document id when no base name is given', async () => {
    render(<Scene3DPreview scene={baseScene({ id: 'scene3d-abc' })} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Take screenshot' }),
    );

    await waitFor(() => expect(mockedDownloadBlob).toHaveBeenCalledTimes(1));
    expect(mockedDownloadBlob.mock.calls[0][1]).toMatch(/^scene3d-abc-screenshot-\d+\.png$/);
  });

  it('hides the button when showScreenshotButton is false (the AI-proposal preview)', () => {
    render(<Scene3DPreview scene={baseScene()} showScreenshotButton={false} />);

    expect(screen.getByRole('button', { name: 'Open piece controls menu' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('hidden');
  });
});
