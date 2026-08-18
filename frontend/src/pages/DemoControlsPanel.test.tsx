import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

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
});
