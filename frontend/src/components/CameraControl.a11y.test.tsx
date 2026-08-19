import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';

import CameraControl from './CameraControl';
import DemoControlsPanel from '../pages/DemoControlsPanel';
import type { TrackingFrame, TrackingProvider, TrackingProviderError } from '../tracking/types';

/**
 * Task 63 (issue #62): automated accessibility checks (axe-core, via
 * `jest-axe`) for the camera lifecycle states (`CameraControl.tsx`) and the
 * demo-input control panel (`DemoControlsPanel.tsx`) — the "demo inputs,
 * ... camera lifecycle states" surfaces named by this issue's audit matrix.
 *
 * `CameraControl` is exercised across every named lifecycle state (idle,
 * starting, active, error, stopped) via a fake `TrackingProvider` — the
 * same fake used by `CameraControl.test.tsx` — so this checks the actual
 * rendered ARIA structure of each state's live status/error regions, not
 * just the idle default.
 */

function createFakeProvider() {
  const frameListeners: Array<(frame: TrackingFrame) => void> = [];
  const errorListeners: Array<(error: TrackingProviderError) => void> = [];
  const provider: TrackingProvider = {
    start: vi.fn(),
    stop: vi.fn(),
    onFrame: vi.fn((listener: (frame: TrackingFrame) => void) => {
      frameListeners.push(listener);
      return () => {};
    }),
    onError: vi.fn((listener: (error: TrackingProviderError) => void) => {
      errorListeners.push(listener);
      return () => {};
    }),
  };
  return {
    provider,
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

const secureContext = () => true;

describe('CameraControl accessibility', () => {
  it('idle state has no axe violations', async () => {
    const fake = createFakeProvider();
    const { container } = render(
      <CameraControl createProvider={() => fake.provider} isSecureContext={secureContext} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('starting state has no axe violations', async () => {
    const fake = createFakeProvider();
    const { container } = render(
      <CameraControl createProvider={() => fake.provider} isSecureContext={secureContext} />,
    );
    const user = userEvent.setup();
    await user.click(container.querySelector('button') as HTMLButtonElement);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('active state has no axe violations', async () => {
    const fake = createFakeProvider();
    const { container } = render(
      <CameraControl createProvider={() => fake.provider} isSecureContext={secureContext} />,
    );
    const user = userEvent.setup();
    await user.click(container.querySelector('button') as HTMLButtonElement);
    fake.emitFrame();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('error state has no axe violations', async () => {
    const fake = createFakeProvider();
    const { container } = render(
      <CameraControl createProvider={() => fake.provider} isSecureContext={secureContext} />,
    );
    const user = userEvent.setup();
    await user.click(container.querySelector('button') as HTMLButtonElement);
    fake.emitError({
      message: 'Camera access was denied or no camera is available.',
      timestamp: 1,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('stopped state has no axe violations', async () => {
    const fake = createFakeProvider();
    const { container } = render(
      <CameraControl createProvider={() => fake.provider} isSecureContext={secureContext} />,
    );
    const user = userEvent.setup();
    await user.click(container.querySelector('button') as HTMLButtonElement);
    fake.emitFrame();
    await user.click(container.querySelector('button') as HTMLButtonElement);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('insecure-context error state has no axe violations', async () => {
    const fake = createFakeProvider();
    const { container } = render(
      <CameraControl createProvider={() => fake.provider} isSecureContext={() => false} />,
    );
    const user = userEvent.setup();
    await user.click(container.querySelector('button') as HTMLButtonElement);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DemoControlsPanel accessibility', () => {
  it('manual mode (default) has no axe violations', async () => {
    const { container } = render(<DemoControlsPanel />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('manual mode with hand present and a gesture selected has no axe violations', async () => {
    const { container } = render(<DemoControlsPanel />);
    const user = userEvent.setup();
    await user.click(
      Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Hand absent',
      ) as HTMLButtonElement,
    );
    await user.click(
      Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Open palm',
      ) as HTMLButtonElement,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('synthetic playback mode has no axe violations', async () => {
    const { container } = render(<DemoControlsPanel />);
    const user = userEvent.setup();
    await user.click(
      Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Synthetic playback',
      ) as HTMLButtonElement,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
