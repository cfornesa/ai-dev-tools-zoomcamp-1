import { useEffect, useState } from 'react';

import { PIANO_KEY_MAP, isEditableElement } from '../audio/pianoKeyMap';
import type { Structured2DCapabilities } from './structured2dCapabilities';

export type Structured2DAudioEngine = {
  readonly status: 'idle' | 'active' | 'error';
  enable(): Promise<void>;
  disable(): void;
  setVolume(percent: number): void;
  connectMic?(): Promise<void>;
  setTempo?(bpm: number): void;
  setScale?(name: string): boolean;
  setKey?(key: { root: string; scale: string }): boolean;
  setTranspose?(semitones: number): void;
  setFollowKey?(follow: boolean): void;
  setVoiceVolume?(voice: 'ambient' | 'melodic', percent: number): void;
  setVoiceMuted?(voice: 'ambient' | 'melodic', muted: boolean): void;
  setFilter?(settings: { type: string; cutoff: number; resonance: number }): boolean;
  setMelodicSynth?(settings: {
    oscillator?: string;
    envelope?: { attack?: number; decay?: number; sustain?: number; release?: number };
    filter?: { type?: string; cutoff?: number; resonance?: number };
    octaveShift?: number;
  }): unknown;
  triggerMelodicNote?(note: string): void;
};

export function Structured2DSoundToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="piece-stage-icon-button"
      aria-label={active ? 'Mute sound' : 'Enable sound'}
      onClick={onToggle}
    >
      {active ? '🔊' : '🔇'}
    </button>
  );
}

export default function Structured2DSoundControls({
  capabilities,
  engine,
  active,
  onActiveChange,
}: {
  capabilities: Structured2DCapabilities;
  engine: Structured2DAudioEngine;
  active?: boolean;
  onActiveChange?: (active: boolean) => void;
}) {
  const [internalActive, setInternalActive] = useState(engine.status === 'active');
  const controlledActive = active ?? internalActive;
  const setActive = onActiveChange ?? setInternalActive;
  const [volume, setVolume] = useState(70);
  const [ambientBpm, setAmbientBpm] = useState(90);
  const [ambientVolume, setAmbientVolume] = useState(50);
  const [ambientMuted, setAmbientMuted] = useState(false);
  const [ambientScale, setAmbientScale] = useState('pentatonic');
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  const [keyboardRoot, setKeyboardRoot] = useState('C');
  const [keyboardScale, setKeyboardScale] = useState('major');
  const [keyboardTranspose, setKeyboardTranspose] = useState(0);
  const [followKey, setFollowKey] = useState(false);
  const [keyboardVolume, setKeyboardVolume] = useState(50);
  const [oscillator, setOscillator] = useState('sine');
  const [filterType, setFilterType] = useState('lowpass');
  const [filterCutoff, setFilterCutoff] = useState(2000);
  const [filterResonance, setFilterResonance] = useState(1);
  const [envelope, setEnvelope] = useState({
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
  });
  const [octave, setOctave] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!controlledActive || !keyboardEnabled || !engine.triggerMelodicNote) return;
    const triggerMelodicNote = engine.triggerMelodicNote;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isEditableElement(event.target)) return;
      const note = PIANO_KEY_MAP[event.key.toLowerCase()];
      if (note) triggerMelodicNote(note);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controlledActive, engine, keyboardEnabled]);

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
        aria-label={controlledActive ? 'Mute sound' : 'Enable sound'}
        onClick={() => {
          if (controlledActive) {
            engine.disable();
            setActive(false);
          } else {
            void activateSound();
          }
        }}
      >
        {controlledActive ? '🔊' : '🔇'}
      </button>
      <label>
        Sound volume
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
      <label htmlFor="structured-2d-ambient-bpm">Ambient BPM: {ambientBpm}</label>
      <input
        id="structured-2d-ambient-bpm"
        type="range"
        min="40"
        max="220"
        value={ambientBpm}
        disabled={!controlledActive}
        onChange={(event) => {
          const next = Number(event.target.value);
          setAmbientBpm(next);
          engine.setTempo?.(next);
        }}
      />
      <label htmlFor="structured-2d-ambient-volume">Ambient volume: {ambientVolume}%</label>
      <input
        id="structured-2d-ambient-volume"
        type="range"
        min="0"
        max="100"
        value={ambientVolume}
        disabled={!controlledActive}
        onChange={(event) => {
          const next = Number(event.target.value);
          setAmbientVolume(next);
          engine.setVoiceVolume?.('ambient', next);
        }}
      />
      <label htmlFor="structured-2d-ambient-muted">
        <input
          id="structured-2d-ambient-muted"
          type="checkbox"
          checked={ambientMuted}
          disabled={!controlledActive}
          onChange={(event) => {
            const next = event.target.checked;
            setAmbientMuted(next);
            engine.setVoiceMuted?.('ambient', next);
          }}
        />{' '}
        Mute ambient
      </label>
      <label htmlFor="structured-2d-ambient-scale">Scale: {ambientScale}</label>
      <select
        id="structured-2d-ambient-scale"
        value={ambientScale}
        disabled={!controlledActive}
        onChange={(event) => {
          const next = event.target.value;
          setAmbientScale(next);
          engine.setScale?.(next);
          if (followKey) setKeyboardScale(next);
        }}
      >
        {[
          'major',
          'minor',
          'pentatonic',
          'chromatic',
          'dorian',
          'phrygian',
          'lydian',
          'mixolydian',
          'wholetone',
        ].map((scale) => (
          <option key={scale}>{scale}</option>
        ))}
      </select>
      <fieldset>
        <legend>Keyboard synth</legend>
        <button
          type="button"
          aria-pressed={keyboardEnabled}
          disabled={!controlledActive}
          onClick={() => setKeyboardEnabled((value) => !value)}
        >
          {keyboardEnabled ? 'Stop keyboard notes' : 'Keyboard notes'}
        </button>
        <label htmlFor="structured-2d-keyboard-root">Key</label>
        <select
          id="structured-2d-keyboard-root"
          value={keyboardRoot}
          disabled={!controlledActive}
          onChange={(event) => {
            const next = event.target.value;
            setKeyboardRoot(next);
            engine.setKey?.({ root: next, scale: keyboardScale });
          }}
        >
          {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((root) => (
            <option key={root}>{root}</option>
          ))}
        </select>
        <label htmlFor="structured-2d-keyboard-scale">Scale</label>
        <select
          id="structured-2d-keyboard-scale"
          value={keyboardScale}
          disabled={!controlledActive || followKey}
          onChange={(event) => {
            const next = event.target.value;
            setKeyboardScale(next);
            engine.setKey?.({ root: keyboardRoot, scale: next });
          }}
        >
          {[
            'major',
            'minor',
            'pentatonic',
            'chromatic',
            'dorian',
            'phrygian',
            'lydian',
            'mixolydian',
            'wholetone',
          ].map((scale) => (
            <option key={scale}>{scale}</option>
          ))}
        </select>
        <label htmlFor="structured-2d-keyboard-transpose">Transpose: {keyboardTranspose}</label>
        <input
          id="structured-2d-keyboard-transpose"
          type="range"
          min="-12"
          max="12"
          step="1"
          value={keyboardTranspose}
          disabled={!controlledActive}
          onChange={(event) => {
            const next = Number(event.target.value);
            setKeyboardTranspose(next);
            engine.setTranspose?.(next);
          }}
        />
        <label htmlFor="structured-2d-follow-key">
          <input
            id="structured-2d-follow-key"
            type="checkbox"
            checked={followKey}
            disabled={!controlledActive}
            onChange={(event) => {
              const next = event.target.checked;
              setFollowKey(next);
              engine.setFollowKey?.(next);
              if (next) {
                setKeyboardScale(ambientScale);
                engine.setKey?.({ root: keyboardRoot, scale: ambientScale });
              }
            }}
          />{' '}
          Link keyboard to ambient scale
        </label>
        <label htmlFor="structured-2d-keyboard-volume">Volume: {keyboardVolume}%</label>
        <input
          id="structured-2d-keyboard-volume"
          type="range"
          min="0"
          max="100"
          value={keyboardVolume}
          disabled={!controlledActive}
          onChange={(event) => {
            const next = Number(event.target.value);
            setKeyboardVolume(next);
            engine.setVoiceVolume?.('melodic', next);
          }}
        />
        <label htmlFor="structured-2d-oscillator">Oscillator</label>
        <select
          id="structured-2d-oscillator"
          value={oscillator}
          disabled={!controlledActive}
          onChange={(event) => {
            const next = event.target.value;
            setOscillator(next);
            engine.setMelodicSynth?.({ oscillator: next });
          }}
        >
          {['sine', 'square', 'sawtooth', 'triangle'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <label htmlFor="structured-2d-filter-type">Filter type</label>
        <select
          id="structured-2d-filter-type"
          value={filterType}
          disabled={!controlledActive}
          onChange={(event) => {
            const next = event.target.value;
            setFilterType(next);
            engine.setFilter?.({ type: next, cutoff: filterCutoff, resonance: filterResonance });
          }}
        >
          {['lowpass', 'highpass', 'bandpass'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <label htmlFor="structured-2d-filter-cutoff">Cutoff: {filterCutoff}</label>
        <input
          id="structured-2d-filter-cutoff"
          type="range"
          min="20"
          max="20000"
          step="20"
          value={filterCutoff}
          disabled={!controlledActive}
          onChange={(event) => {
            const next = Number(event.target.value);
            setFilterCutoff(next);
            engine.setFilter?.({ type: filterType, cutoff: next, resonance: filterResonance });
          }}
        />
        <label htmlFor="structured-2d-filter-resonance">Resonance: {filterResonance}</label>
        <input
          id="structured-2d-filter-resonance"
          type="range"
          min="0.1"
          max="20"
          step="0.1"
          value={filterResonance}
          disabled={!controlledActive}
          onChange={(event) => {
            const next = Number(event.target.value);
            setFilterResonance(next);
            engine.setFilter?.({ type: filterType, cutoff: filterCutoff, resonance: next });
          }}
        />
        {(Object.keys(envelope) as (keyof typeof envelope)[]).map((field) => (
          <label key={field} htmlFor={`structured-2d-envelope-${field}`}>
            {field}: {envelope[field]}
            <input
              id={`structured-2d-envelope-${field}`}
              type="range"
              min={field === 'sustain' ? 0 : 0.001}
              max={field === 'sustain' ? 1 : 10}
              step={field === 'sustain' ? 0.01 : 0.001}
              value={envelope[field]}
              disabled={!controlledActive}
              onChange={(event) => {
                const next = Number(event.target.value);
                const updated = { ...envelope, [field]: next };
                setEnvelope(updated);
                engine.setMelodicSynth?.({ envelope: updated });
              }}
            />
          </label>
        ))}
        <label htmlFor="structured-2d-octave">Octave: {octave}</label>
        <input
          id="structured-2d-octave"
          type="range"
          min="-2"
          max="2"
          value={octave}
          disabled={!controlledActive}
          onChange={(event) => {
            const next = Number(event.target.value);
            setOctave(next);
            engine.setMelodicSynth?.({ octaveShift: next });
          }}
        />
      </fieldset>
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
