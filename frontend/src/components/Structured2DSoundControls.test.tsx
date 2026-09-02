import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Structured2DSoundControls from './Structured2DSoundControls';
import type { Structured2DCapabilities } from './structured2dCapabilities';

const enabled: Structured2DCapabilities = { sound: true, voiceInput: true, microphone: true };
const disabled: Structured2DCapabilities = { sound: false, voiceInput: false, microphone: false };

function makeEngine(status: 'idle' | 'active' | 'error' = 'idle') {
  return {
    status,
    enable: vi.fn(async () => undefined),
    disable: vi.fn(),
    setVolume: vi.fn(),
    connectMic: vi.fn(async () => undefined),
  };
}

describe('Structured2DSoundControls', () => {
  it('renders nothing for an explicitly disabled capability', () => {
    render(<Structured2DSoundControls capabilities={disabled} engine={makeEngine()} />);
    expect(screen.queryByRole('group', { name: 'Sound controls' })).not.toBeInTheDocument();
  });

  it('renders only enabled input controls and activates audio on click', async () => {
    const user = userEvent.setup();
    const audio = makeEngine();
    render(<Structured2DSoundControls capabilities={enabled} engine={audio} />);
    expect(screen.getByRole('button', { name: 'Enable sound' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable voice input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable microphone' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));
    expect(audio.enable).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Mute sound' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mute sound' }));
    expect(audio.disable).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Enable sound' })).toBeInTheDocument();
  });

  it('does not request microphone access while idle', async () => {
    const user = userEvent.setup();
    const audio = makeEngine();
    render(<Structured2DSoundControls capabilities={enabled} engine={audio} />);
    expect(audio.connectMic).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Enable microphone' }));
    expect(audio.connectMic).toHaveBeenCalledTimes(1);
  });

  it('reports failures while leaving controls available', async () => {
    const user = userEvent.setup();
    const audio = makeEngine();
    audio.enable.mockRejectedValueOnce(new Error('blocked'));
    render(<Structured2DSoundControls capabilities={enabled} engine={audio} />);
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Sound could not start');
    expect(screen.getByRole('button', { name: 'Enable sound' })).toBeInTheDocument();
  });
});
