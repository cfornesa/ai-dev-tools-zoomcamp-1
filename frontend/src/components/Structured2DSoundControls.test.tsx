import { fireEvent, render, screen } from '@testing-library/react';
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
    setTempo: vi.fn(),
    setVoiceVolume: vi.fn(),
    setVoiceMuted: vi.fn(),
    setScale: vi.fn(() => true),
    setFilter: vi.fn(() => true),
    setMelodicSynth: vi.fn(),
    triggerMelodicNote: vi.fn(),
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

  it('forwards ambient and keyboard controls to the shared engine', async () => {
    const user = userEvent.setup();
    const audio = makeEngine();
    render(
      <Structured2DSoundControls
        capabilities={enabled}
        engine={audio}
        active
        onActiveChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('slider', { name: /Ambient BPM/ }), {
      target: { value: '120' },
    });
    fireEvent.change(screen.getByRole('slider', { name: /Ambient volume/ }), {
      target: { value: '60' },
    });
    await user.selectOptions(screen.getByRole('combobox', { name: /Scale/ }), 'major');
    await user.click(screen.getByRole('button', { name: 'Keyboard notes' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Oscillator' }), 'square');
    expect(audio.setTempo).toHaveBeenCalled();
    expect(audio.setVoiceVolume).toHaveBeenCalledWith('ambient', expect.any(Number));
    expect(audio.setScale).toHaveBeenCalledWith('major');
    expect(audio.setMelodicSynth).toHaveBeenCalledWith({ oscillator: 'square' });
  });
});
