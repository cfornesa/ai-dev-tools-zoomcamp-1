import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import CameraControl from './CameraControl';
import DemoControlsPanel from '../pages/DemoControlsPanel';
import type { TrackingFrame, TrackingProvider, TrackingProviderError } from '../tracking/types';

/** jsdom's `window.isSecureContext` does not implement the browser rule
 * that `http://localhost` counts as a secure context, so it defaults to
 * `false` in every test here — every test below that expects the camera
 * to actually be able to start passes this override explicitly instead of
 * relying on the real `window.isSecureContext` (which the "insecure
 * context" test below overrides the other way, to `false`, on purpose). */
const secureContext = () => true;

/** A fully controllable fake `TrackingProvider` (never touches a real
 * camera or MediaPipe) plus test hooks to inspect how many times its
 * lifecycle methods and subscriptions were used — the mechanism the
 * "no duplicate provider/stream/listener on retry" tests rely on. */
function createFakeProvider() {
  const frameListeners: Array<(frame: TrackingFrame) => void> = [];
  const errorListeners: Array<(error: TrackingProviderError) => void> = [];
  const start = vi.fn();
  const stop = vi.fn();
  const onFrame = vi.fn((listener: (frame: TrackingFrame) => void) => {
    frameListeners.push(listener);
    return () => {
      const index = frameListeners.indexOf(listener);
      if (index >= 0) frameListeners.splice(index, 1);
    };
  });
  const onError = vi.fn((listener: (error: TrackingProviderError) => void) => {
    errorListeners.push(listener);
    return () => {
      const index = errorListeners.indexOf(listener);
      if (index >= 0) errorListeners.splice(index, 1);
    };
  });

  const provider: TrackingProvider = { start, stop, onFrame, onError };

  return {
    provider,
    start,
    stop,
    onFrame,
    onError,
    frameListenerCount: () => frameListeners.length,
    errorListenerCount: () => errorListeners.length,
    emitFrame: (frame: TrackingFrame = { timestamp: 1, hands: [], events: [] }) => {
      act(() => {
        for (const listener of [...frameListeners]) listener(frame);
      });
    },
    emitError: (error: TrackingProviderError) => {
      act(() => {
        for (const listener of [...errorListeners]) listener(error);
      });
    },
  };
}

describe('CameraControl', () => {
  it('does not create a provider or start capture on mount', () => {
    const fake = createFakeProvider();
    const createProvider = vi.fn(() => fake.provider);
    render(<CameraControl createProvider={createProvider} />);

    expect(createProvider).not.toHaveBeenCalled();
    expect(fake.start).not.toHaveBeenCalled();
  });

  it('shows the local-processing privacy notice and Enable camera button before activation', () => {
    const fake = createFakeProvider();
    render(<CameraControl createProvider={() => fake.provider} />);

    expect(
      screen.getByText(/processed locally in your browser/i, { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText(/never recorded, stored, or uploaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable camera' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop camera' })).not.toBeInTheDocument();
  });

  it('starts the provider only after Enable camera is clicked, then shows a live status and Stop camera once frames arrive', async () => {
    const user = userEvent.setup({ delay: null });
    const fake = createFakeProvider();
    const createProvider = vi.fn(() => fake.provider);
    render(<CameraControl createProvider={createProvider} isSecureContext={secureContext} />);

    await user.click(screen.getByRole('button', { name: 'Enable camera' }));
    expect(createProvider).toHaveBeenCalledTimes(1);
    expect(fake.start).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('camera-status')).toHaveTextContent(/starting/i);

    fake.emitFrame();
    expect(screen.getByTestId('camera-status')).toHaveTextContent(/camera is active/i);
    expect(screen.getByRole('status')).toHaveTextContent(/camera is active/i);
    expect(screen.getByRole('button', { name: 'Stop camera' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable camera' })).not.toBeInTheDocument();
  });

  it('releases resources and returns to a stoppable-again state when Stop camera is pressed', async () => {
    const user = userEvent.setup({ delay: null });
    const fake = createFakeProvider();
    render(<CameraControl createProvider={() => fake.provider} isSecureContext={secureContext} />);

    await user.click(screen.getByRole('button', { name: 'Enable camera' }));
    fake.emitFrame();
    await user.click(screen.getByRole('button', { name: 'Stop camera' }));

    expect(fake.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('camera-status')).toHaveTextContent(/camera stopped/i);
    expect(screen.getByRole('button', { name: 'Enable camera' })).toBeInTheDocument();
  });

  it('shows the insecure-context recovery message and never creates a provider when the context is insecure', async () => {
    const user = userEvent.setup({ delay: null });
    const fake = createFakeProvider();
    const createProvider = vi.fn(() => fake.provider);
    render(<CameraControl createProvider={createProvider} isSecureContext={() => false} />);

    await user.click(screen.getByRole('button', { name: 'Enable camera' }));

    expect(createProvider).not.toHaveBeenCalled();
    expect(fake.start).not.toHaveBeenCalled();
    expect(screen.getByTestId('camera-error')).toHaveTextContent(/secure connection \(https\)/i);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  const failureCases: Array<{
    name: string;
    error: TrackingProviderError;
    expectedText: RegExp;
  }> = [
    {
      name: 'unsupported browser',
      error: { message: 'MediaPipe hand tracking is not supported in this browser.', timestamp: 0 },
      expectedText: /doesn't support the camera hand-tracking/i,
    },
    {
      name: 'permission denied',
      error: {
        message: 'Camera access was denied or no camera is available.',
        timestamp: 0,
        cause: Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
      },
      expectedText: /camera access was denied/i,
    },
    {
      name: 'missing device',
      error: {
        message: 'Camera access was denied or no camera is available.',
        timestamp: 0,
        cause: Object.assign(new Error('missing'), { name: 'NotFoundError' }),
      },
      expectedText: /no camera was found/i,
    },
    {
      name: 'model failure',
      error: { message: 'Failed to load the gesture recognizer model.', timestamp: 0 },
      expectedText: /hand-tracking model could not be loaded/i,
    },
    {
      name: 'tracking failure',
      error: { message: 'Gesture recognizer inference failed.', timestamp: 0 },
      expectedText: /hand tracking stopped unexpectedly/i,
    },
  ];

  it.each(failureCases)(
    'shows a specific recovery message for a $name failure',
    async ({ error, expectedText }) => {
      const user = userEvent.setup({ delay: null });
      const fake = createFakeProvider();
      render(
        <CameraControl createProvider={() => fake.provider} isSecureContext={secureContext} />,
      );

      await user.click(screen.getByRole('button', { name: 'Enable camera' }));
      fake.emitError(error);

      expect(screen.getByTestId('camera-error')).toHaveTextContent(expectedText);
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Stop camera' })).not.toBeInTheDocument();
    },
  );

  it('retrying after a recoverable failure reuses the same provider instance and listeners rather than duplicating them', async () => {
    const user = userEvent.setup({ delay: null });
    const fake = createFakeProvider();
    const createProvider = vi.fn(() => fake.provider);
    render(<CameraControl createProvider={createProvider} isSecureContext={secureContext} />);

    await user.click(screen.getByRole('button', { name: 'Enable camera' }));
    fake.emitError({ message: 'Gesture recognizer inference failed.', timestamp: 0 });
    expect(fake.frameListenerCount()).toBe(1);
    expect(fake.errorListenerCount()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(createProvider).toHaveBeenCalledTimes(1); // still just one provider instance
    expect(fake.start).toHaveBeenCalledTimes(2); // start() called again, but on the same instance
    expect(fake.onFrame).toHaveBeenCalledTimes(1); // no second subscription
    expect(fake.onError).toHaveBeenCalledTimes(1);
    expect(fake.frameListenerCount()).toBe(1);
    expect(fake.errorListenerCount()).toBe(1);

    fake.emitFrame();
    expect(screen.getByTestId('camera-status')).toHaveTextContent(/camera is active/i);
  });

  it('keeps the demo controls panel present and usable before camera activation, during a camera failure, and after stopping', async () => {
    const user = userEvent.setup({ delay: null });
    const fake = createFakeProvider();
    render(
      <div>
        <CameraControl createProvider={() => fake.provider} isSecureContext={secureContext} />
        <DemoControlsPanel />
      </div>,
    );

    // Before activation.
    const handButton = () => screen.getByRole('button', { name: /^Hand (present|absent)$/ });
    expect(handButton()).toBeEnabled();

    // During a camera failure.
    await user.click(screen.getByRole('button', { name: 'Enable camera' }));
    fake.emitError({ message: 'Gesture recognizer inference failed.', timestamp: 0 });
    expect(screen.getByTestId('camera-error')).toBeInTheDocument();
    expect(handButton()).toBeEnabled();
    await user.click(handButton());
    expect(handButton()).toHaveTextContent('Hand present');

    // After stopping (retry then go active, then stop).
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    fake.emitFrame();
    await user.click(screen.getByRole('button', { name: 'Stop camera' }));
    expect(handButton()).toBeEnabled();
  });
});
