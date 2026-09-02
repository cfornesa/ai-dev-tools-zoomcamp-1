import { useState } from 'react';

import type { Structured2DCapabilities } from './structured2dCapabilities';

export type Structured2DAudioEngine = {
  readonly status: 'idle' | 'active' | 'error';
  enable(): Promise<void>;
  disable(): void;
  setVolume(percent: number): void;
  connectMic?(): Promise<void>;
};

export default function Structured2DSoundControls({
  capabilities,
  engine,
}: {
  capabilities: Structured2DCapabilities;
  engine: Structured2DAudioEngine;
}) {
  const [volume, setVolume] = useState(70);
  const [active, setActive] = useState(engine.status === 'active');
  const [message, setMessage] = useState<string | null>(null);

  if (!capabilities.sound) return null;

  async function activateSound() {
    setMessage(null);
    try {
      await engine.enable();
      if (engine.status === 'error') setMessage('Sound could not start. Try again.');
      else setActive(true);
    } catch {
      setMessage('Sound could not start. Try again.');
    }
  }

  async function activateMicrophone() {
    setMessage(null);
    try {
      if (!engine.connectMic) throw new Error('Microphone input is unavailable.');
      await engine.connectMic();
    } catch {
      setMessage('Microphone access failed. Check browser permissions and try again.');
    }
  }

  return (
    <div role="group" aria-label="Sound controls" className="piece-stage-sound-controls">
      <button
        type="button"
        className="piece-stage-icon-button"
        aria-label={active ? 'Mute sound' : 'Enable sound'}
        onClick={() => {
          if (active) {
            engine.disable();
            setActive(false);
          } else {
            void activateSound();
          }
        }}
      >
        {active ? '🔊' : '🔇'}
      </button>
      <label>
        Volume
        <input
          aria-label="Volume"
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(event) => {
            const next = Number(event.target.value);
            setVolume(next);
            engine.setVolume(next);
          }}
        />
      </label>
      {capabilities.voiceInput && (
        <button
          type="button"
          onClick={() => setMessage('Voice input is ready after sound is enabled.')}
        >
          Enable voice input
        </button>
      )}
      {capabilities.microphone && (
        <button type="button" onClick={() => void activateMicrophone()}>
          Enable microphone
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
