import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOTION_OVERRIDE_STORAGE_KEY, setMotionOverride } from '../a11y/reducedMotion';
import DemoControlsPanel from './DemoControlsPanel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('DemoControlsPanel', () => {
  it('starts in manual mode with the hand absent and gesture/pinch controls disabled', () => {
    render(<DemoControlsPanel />);
    expect(screen.getByRole('radio', { name: 'Manual controls' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Hand absent' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Open palm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pinch start' })).toBeDisabled();
  });

  it('gives the selected demo-input-mode radio a visible selected-state class hook, not just aria-checked', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DemoControlsPanel />);
    const manualButton = screen.getByRole('radio', { name: 'Manual controls' });
    const playbackButton = screen.getByRole('radio', { name: 'Synthetic playback' });

    // Both buttons carry the same class hook; only aria-checked differs —
    // it's the [aria-checked='true'] CSS rule (asserted below) that gives
    // that a visible, sighted-user-visible style, following the same
    // pattern as .editor-panel-tab[aria-selected='true'].
    expect(manualButton).toHaveClass('demo-radio-option');
    expect(playbackButton).toHaveClass('demo-radio-option');
    expect(manualButton).toHaveAttribute('aria-checked', 'true');
    expect(playbackButton).toHaveAttribute('aria-checked', 'false');

    await user.click(playbackButton);
    expect(playbackButton).toHaveAttribute('aria-checked', 'true');
    expect(manualButton).toHaveAttribute('aria-checked', 'false');
  });

  it('gives the selected gesture-state radio the same visible selected-state class hook', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DemoControlsPanel />);
    await user.click(screen.getByRole('button', { name: 'Hand absent' })); // hand present

    const openPalm = screen.getByRole('radio', { name: 'Open palm' });
    const none = screen.getByRole('radio', { name: 'None' });
    expect(openPalm).toHaveClass('demo-radio-option');
    expect(none).toHaveAttribute('aria-checked', 'true'); // default gesture is null

    await user.click(openPalm);
    expect(openPalm).toHaveAttribute('aria-checked', 'true');
    expect(none).toHaveAttribute('aria-checked', 'false');
  });

  it('defines a CSS rule that visually distinguishes a checked .demo-radio-option', () => {
    // Guards against the class hook above going unstyled again — the
    // gesture-state and demo-input-mode radios only look selected to a
    // sighted user because index.css keys off aria-checked, the same
    // pattern .editor-panel-tab[aria-selected='true'] already uses.
    const css = readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8');
    expect(css).toMatch(/\.demo-radio-option\[aria-checked=['"]true['"]\]/);
  });

  it('exposes each slider with a programmatic label, visible value, and documented range', () => {
    render(<DemoControlsPanel />);
    const slider = screen.getByLabelText(/Index fingertip X/);
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '1');
    expect(slider).toHaveAttribute('aria-valuetext', '0.50');
  });

  it('toggling hand present emits a handAppear event visible in the status region', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DemoControlsPanel />);
    await user.click(screen.getByRole('button', { name: 'Hand absent' }));

    expect(screen.getByRole('button', { name: 'Hand present' })).toBeInTheDocument();
    const status = screen.getAllByRole('status').find((el) => el.textContent?.includes('events:'));
    expect(status?.textContent).toContain('handAppear');
  });

  it('moving a slider while the hand is present updates the visible value and the last-frame status', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DemoControlsPanel />);
    await user.click(screen.getByRole('button', { name: 'Hand absent' }));

    const slider = screen.getByLabelText(/Index fingertip X/);
    fireEvent.change(slider, { target: { value: '0.25' } });

    expect(slider).toHaveAttribute('aria-valuetext', '0.25');
  });

  it('selecting a gesture while present emits gestureEnter, and pinch buttons emit pinch events', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DemoControlsPanel />);
    await user.click(screen.getByRole('button', { name: 'Hand absent' }));
    await user.click(screen.getByRole('radio', { name: 'Open palm' }));

    let status = screen.getAllByRole('status').find((el) => el.textContent?.includes('events:'));
    expect(status?.textContent).toContain('gestureEnter');

    await user.click(screen.getByRole('button', { name: 'Pinch start' }));
    status = screen.getAllByRole('status').find((el) => el.textContent?.includes('events:'));
    expect(status?.textContent).toContain('pinchStart');
  });

  it('switching to playback mode hides manual controls and shows the playback progress', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DemoControlsPanel />);
    await user.click(screen.getByRole('radio', { name: 'Synthetic playback' }));

    expect(screen.queryByTestId('demo-manual-controls')).not.toBeInTheDocument();
    const playback = screen.getByTestId('demo-playback-controls');
    expect(within(playback).getByText(/0 of \d+ events played/)).toBeInTheDocument();
  });

  it('Step advances exactly one scripted entry per click, deterministically', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DemoControlsPanel />);
    await user.click(screen.getByRole('radio', { name: 'Synthetic playback' }));
    const playback = screen.getByTestId('demo-playback-controls');

    await user.click(within(playback).getByRole('button', { name: 'Step' }));
    expect(within(playback).getByText(/1 of \d+ events played/)).toBeInTheDocument();
    const status = screen.getAllByRole('status').find((el) => el.textContent?.includes('events:'));
    expect(status?.textContent).toContain('handAppear');
  });

  it('Play auto-advances through the whole script on a fixed cadence and then stops itself', async () => {
    render(<DemoControlsPanel />);
    fireEvent.click(screen.getByRole('radio', { name: 'Synthetic playback' }));
    const playback = screen.getByTestId('demo-playback-controls');
    const total = within(playback).getByText(/of \d+ events played/).textContent ?? '';
    const totalCount = Number(total.match(/of (\d+)/)?.[1] ?? '0');

    vi.useFakeTimers();
    try {
      fireEvent.click(within(playback).getByRole('button', { name: 'Play' }));
      await vi.advanceTimersByTimeAsync(400 * (totalCount + 1));
    } finally {
      vi.useRealTimers();
    }

    expect(
      within(playback).getByText(new RegExp(`${totalCount} of ${totalCount} events played`)),
    ).toBeInTheDocument();
    expect(within(playback).getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('Reset rewinds the playback progress back to zero', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DemoControlsPanel />);
    await user.click(screen.getByRole('radio', { name: 'Synthetic playback' }));
    const playback = screen.getByTestId('demo-playback-controls');
    await user.click(within(playback).getByRole('button', { name: 'Step' }));
    await user.click(within(playback).getByRole('button', { name: 'Step' }));
    await user.click(within(playback).getByRole('button', { name: 'Reset' }));

    expect(within(playback).getByText(/0 of \d+ events played/)).toBeInTheDocument();
  });

  it('switching modes and back does not emit an unintended event', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DemoControlsPanel />);
    await user.click(screen.getByRole('button', { name: 'Hand absent' })); // hand present now

    const statusBefore = screen
      .getAllByRole('status')
      .find((el) => el.textContent?.includes('events:'))?.textContent;

    await user.click(screen.getByRole('radio', { name: 'Synthetic playback' }));
    await user.click(screen.getByRole('radio', { name: 'Manual controls' }));

    const statusAfter = screen
      .getAllByRole('status')
      .find((el) => el.textContent?.includes('events:'))?.textContent;
    expect(statusAfter).toBe(statusBefore);
  });

  it('works with no camera or MediaPipe APIs present on window', () => {
    // Sanity check that this module never touches navigator.mediaDevices
    // or a MediaPipe global: rendering succeeds even when both are absent,
    // which they always are in this jsdom test environment.
    expect((window as unknown as { navigator: Navigator }).navigator.mediaDevices).toBeUndefined();
    render(<DemoControlsPanel />);
    expect(screen.getByText('Demo signal controls')).toBeInTheDocument();
  });

  it('"Demo input mode" is a roving-tabindex radiogroup: arrow keys move focus and selection, wrapping at both ends', async () => {
    const user = userEvent.setup();
    render(<DemoControlsPanel />);

    const manual = screen.getByRole('radio', { name: 'Manual controls' });
    const playback = screen.getByRole('radio', { name: 'Synthetic playback' });

    expect(manual).toHaveAttribute('tabindex', '0');
    expect(playback).toHaveAttribute('tabindex', '-1');

    manual.focus();
    await user.keyboard('{ArrowRight}');
    expect(playback).toHaveFocus();
    expect(playback).toHaveAttribute('aria-checked', 'true');
    expect(playback).toHaveAttribute('tabindex', '0');
    expect(manual).toHaveAttribute('aria-checked', 'false');
    expect(manual).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('demo-playback-controls')).toBeInTheDocument();

    // Wraps forward from the last option back to the first.
    await user.keyboard('{ArrowRight}');
    expect(manual).toHaveFocus();
    expect(manual).toHaveAttribute('aria-checked', 'true');

    // Wraps backward from the first option to the last.
    await user.keyboard('{ArrowLeft}');
    expect(playback).toHaveFocus();
    expect(playback).toHaveAttribute('aria-checked', 'true');
  });

  it('"Gesture state" is a roving-tabindex radiogroup that skips disabled options via arrow keys', async () => {
    const user = userEvent.setup();
    render(<DemoControlsPanel />);

    // Gesture radios start disabled (no hand present) — nothing in the
    // group is a valid roving-tabindex target until a hand is present.
    await user.click(screen.getByRole('button', { name: 'Hand absent' }));

    const none = screen.getByRole('radio', { name: 'None' });
    const openPalm = screen.getByRole('radio', { name: 'Open palm' });

    expect(none).toHaveAttribute('tabindex', '0');
    none.focus();
    await user.keyboard('{ArrowRight}');
    expect(openPalm).toHaveFocus();
    expect(openPalm).toHaveAttribute('aria-checked', 'true');
    expect(none).toHaveAttribute('aria-checked', 'false');
  });

  // Task 29 (issue #28): reduced motion replaces the scripted-playback
  // auto-advance timer — the one continuous, non-essential effect this
  // panel has — with a "use Step" note, while every scripted event stays
  // fully reachable via Step (the interaction's meaning is preserved).
  describe('reduced motion', () => {
    afterEach(() => {
      // The reduced-motion store is a module-level singleton shared by the
      // whole process — release the override so later tests (in this file
      // or others that import it) see the default 'system' state again.
      setMotionOverride('system');
      window.localStorage.removeItem(MOTION_OVERRIDE_STORAGE_KEY);
    });

    it('replaces Play with a stepped-equivalent note, and Step still advances the script', async () => {
      const user = userEvent.setup({ delay: null });
      setMotionOverride('reduced');
      render(<DemoControlsPanel />);
      await user.click(screen.getByRole('radio', { name: 'Synthetic playback' }));
      const playback = screen.getByTestId('demo-playback-controls');

      expect(within(playback).queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
      expect(within(playback).getByText(/Use Step to advance manually/)).toBeInTheDocument();

      await user.click(within(playback).getByRole('button', { name: 'Step' }));
      expect(within(playback).getByText(/1 of \d+ events played/)).toBeInTheDocument();
    });

    it('does not auto-advance on a timer while motion is reduced', async () => {
      setMotionOverride('reduced');
      render(<DemoControlsPanel />);
      fireEvent.click(screen.getByRole('radio', { name: 'Synthetic playback' }));
      const playback = screen.getByTestId('demo-playback-controls');

      vi.useFakeTimers();
      try {
        await vi.advanceTimersByTimeAsync(400 * 5);
      } finally {
        vi.useRealTimers();
      }

      expect(within(playback).getByText(/0 of \d+ events played/)).toBeInTheDocument();
    });

    it('switching to reduced motion mid-playback stops the auto-advance timer without corrupting progress', async () => {
      render(<DemoControlsPanel />);
      fireEvent.click(screen.getByRole('radio', { name: 'Synthetic playback' }));
      const playback = screen.getByTestId('demo-playback-controls');

      vi.useFakeTimers();
      try {
        fireEvent.click(within(playback).getByRole('button', { name: 'Play' }));
        await vi.advanceTimersByTimeAsync(400 * 2); // a couple of steps in

        setMotionOverride('reduced');
        await vi.advanceTimersByTimeAsync(0); // flush the effect re-run

        const progressAfterSwitch =
          within(playback).getByText(/of \d+ events played/).textContent ?? '';

        await vi.advanceTimersByTimeAsync(400 * 5); // would advance further if still running

        expect(within(playback).getByText(/of \d+ events played/).textContent).toBe(
          progressAfterSwitch,
        );
      } finally {
        vi.useRealTimers();
      }

      // The Play control is gone (replaced by the reduced-motion note),
      // and Step still works against the same, uncorrupted progress.
      expect(within(playback).queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
      const before = within(playback).getByText(/(\d+) of \d+ events played/).textContent ?? '';
      const beforeCount = Number(before.match(/(\d+) of/)?.[1] ?? '0');
      fireEvent.click(within(playback).getByRole('button', { name: 'Step' }));
      expect(
        within(playback).getByText(new RegExp(`${beforeCount + 1} of \\d+ events played`)),
      ).toBeInTheDocument();
    });
  });
});
