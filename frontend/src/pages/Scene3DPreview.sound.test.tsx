import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SonicEngine, SonicEngineStatus } from '../audio/sonicEngine';
import type { Scene3DDocument } from './scene3dTypes';

/**
 * Issue #306: the minimal master sound enable/volume control in
 * `Scene3DPreview.tsx`. `createSonicEngine` is mocked wholesale as a
 * controllable stub -- its own audio-graph behavior is already covered by
 * `sonicEngine.test.ts` -- matching this file's own convention of mocking
 * `CameraControl`/`THREE.WebGLRenderer` at their module boundaries rather
 * than reimplementing their internals here.
 */

const {
  engineStatusRef,
  enableSpy,
  disableSpy,
  setVolumeSpy,
  reportMovementSpy,
  triggerMelodicNoteSpy,
  connectMicSpy,
  disconnectMicSpy,
} = vi.hoisted(() => ({
  engineStatusRef: { current: 'idle' as SonicEngineStatus },
  enableSpy: vi.fn(),
  disableSpy: vi.fn(),
  setVolumeSpy: vi.fn(),
  reportMovementSpy: vi.fn(),
  triggerMelodicNoteSpy: vi.fn(),
  connectMicSpy: vi.fn().mockResolvedValue(undefined),
  disconnectMicSpy: vi.fn(),
}));

vi.mock('../audio/sonicEngine', () => ({
  createSonicEngine: (): SonicEngine => ({
    get status() {
      return engineStatusRef.current;
    },
    enable: async () => {
      enableSpy();
      engineStatusRef.current = 'active';
    },
    disable: () => {
      disableSpy();
      engineStatusRef.current = 'idle';
    },
    setVolume: setVolumeSpy,
    reportMovement: reportMovementSpy,
    triggerMelodicNote: triggerMelodicNoteSpy,
    connectMic: connectMicSpy,
    disconnectMic: disconnectMicSpy,
    dispose: vi.fn(),
  }),
}));

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
      }
      clone() {
        return { x: this.x, y: this.y, z: this.z };
      }
    })();
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

beforeEach(() => {
  engineStatusRef.current = 'idle';
  vi.clearAllMocks();
  // jsdom's `window.isSecureContext` does not implement the browser rule
  // that `http://localhost` counts secure -- it defaults to `false`,
  // which would otherwise route every "Live mic" click into the
  // insecure-context error path before ever calling `connectMic`.
  // Matches `Scene3DPreview.gestureControl.test.tsx`'s own documented
  // workaround for the identical jsdom gap.
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
});

describe('Scene3DPreview sound control (issue #306)', () => {
  it('shows "Enable sound", off by default, and no volume slider yet', () => {
    render(<Scene3DPreview scene={baseScene()} />);

    const toggle = screen.getByRole('button', { name: 'Enable sound' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText('Sound volume')).not.toBeInTheDocument();
    expect(enableSpy).not.toHaveBeenCalled();
  });

  it('enabling sound calls engine.enable() and reveals the volume slider', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Enable sound' }));

    expect(enableSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('Sound volume')).toBeInTheDocument();
  });

  it('adjusting the slider calls engine.setVolume()', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));

    const slider = screen.getByLabelText('Sound volume') as HTMLInputElement;
    act(() => {
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    slider.value = '80';
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(setVolumeSpy).toHaveBeenCalled();
  });

  it('muting calls engine.disable() and hides the volume slider again', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));

    await user.click(screen.getByRole('button', { name: 'Mute sound' }));

    expect(disableSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Enable sound' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByLabelText('Sound volume')).not.toBeInTheDocument();
  });

  it('never shows the sound control when showSoundControl is false', () => {
    render(<Scene3DPreview scene={baseScene()} showSoundControl={false} />);
    expect(screen.queryByRole('button', { name: /sound/i })).not.toBeInTheDocument();
  });

  it('reports camera movement to the engine every render tick', async () => {
    render(<Scene3DPreview scene={baseScene()} />);

    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(reportMovementSpy).toHaveBeenCalled();
  });
});

describe('Scene3DPreview keyboard-triggered notes (issue #307)', () => {
  it('shows no "Keyboard notes" toggle until sound is enabled', () => {
    render(<Scene3DPreview scene={baseScene()} />);
    expect(screen.queryByRole('button', { name: /keyboard notes/i })).not.toBeInTheDocument();
  });

  it('pressing a mapped key triggers a melodic note once both sound and keyboard notes are on', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));
    await user.click(screen.getByRole('button', { name: 'Keyboard notes' }));

    await user.keyboard('a');

    expect(triggerMelodicNoteSpy).toHaveBeenCalledWith('C4');
  });

  it('does nothing while the toggle is off, even with sound enabled', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));

    await user.keyboard('a');

    expect(triggerMelodicNoteSpy).not.toHaveBeenCalled();
  });

  it('never fires while typing in an unrelated form field', async () => {
    render(
      <div>
        <input aria-label="Unrelated field" />
        <Scene3DPreview scene={baseScene()} />
      </div>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));
    await user.click(screen.getByRole('button', { name: 'Keyboard notes' }));

    await user.click(screen.getByLabelText('Unrelated field'));
    await user.keyboard('a');

    expect(triggerMelodicNoteSpy).not.toHaveBeenCalled();
  });

  it('stops responding once sound is muted, and resets the toggle', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));
    await user.click(screen.getByRole('button', { name: 'Keyboard notes' }));

    await user.click(screen.getByRole('button', { name: 'Mute sound' }));
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));
    await user.keyboard('a');

    expect(triggerMelodicNoteSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /keyboard notes/i, pressed: true })).toBeNull();
  });
});

describe('Scene3DPreview live mic (issue #308)', () => {
  it('shows no "Live mic" toggle until sound is enabled', () => {
    render(<Scene3DPreview scene={baseScene()} />);
    expect(screen.queryByRole('button', { name: /live mic/i })).not.toBeInTheDocument();
  });

  it('enabling the mic calls engine.connectMic() and shows the privacy notice', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));

    await user.click(screen.getByRole('button', { name: 'Live mic' }));

    expect(connectMicSpy).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Stop live mic' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('mic-privacy-notice')).toBeInTheDocument();
  });

  it('shows a friendly error message when the mic permission is denied', async () => {
    connectMicSpy.mockRejectedValueOnce(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    );
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));

    await user.click(screen.getByRole('button', { name: 'Live mic' }));

    expect(await screen.findByTestId('mic-error')).toHaveTextContent(/denied/i);
    expect(screen.getByRole('button', { name: 'Live mic' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('stopping the mic calls engine.disconnectMic() and hides the privacy notice', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));
    await user.click(screen.getByRole('button', { name: 'Live mic' }));
    await screen.findByRole('button', { name: 'Stop live mic' });

    await user.click(screen.getByRole('button', { name: 'Stop live mic' }));

    expect(disconnectMicSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Live mic' })).toBeInTheDocument();
    expect(screen.queryByTestId('mic-privacy-notice')).not.toBeInTheDocument();
  });

  it('muting sound also releases an active mic state', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));
    await user.click(screen.getByRole('button', { name: 'Live mic' }));
    await screen.findByRole('button', { name: 'Stop live mic' });

    await user.click(screen.getByRole('button', { name: 'Mute sound' }));

    expect(screen.queryByRole('button', { name: /live mic/i })).not.toBeInTheDocument();
  });
});
