import type { SonicDefaults } from '../audio/sonicContract';
import {
  SONIC_INSTRUMENTS,
  SONIC_ROOTS,
  SONIC_SCALES,
  normalizeSonic,
} from '../audio/sonicContract';

type Props = { value: SonicDefaults | undefined; onChange: (value: SonicDefaults) => void };

export default function SonicDefaultsPanel({ value, onChange }: Props) {
  const current = value ?? normalizeSonic({})!;
  const update = (patch: Partial<SonicDefaults>) => onChange({ ...current, ...patch });
  const updateExtras = (patch: Partial<SonicDefaults['extras']>) =>
    onChange({ ...current, extras: { ...current.extras, ...patch } });
  const updateSynth = (patch: Partial<SonicDefaults['extras']['synth']>) =>
    updateExtras({ synth: { ...current.extras.synth, ...patch } });
  const updateEnvelope = (patch: Partial<SonicDefaults['extras']['synth']['envelope']>) =>
    updateSynth({ envelope: { ...current.extras.synth.envelope, ...patch } });

  return (
    <div role="group" aria-label="Authored sound defaults" className="editor-sound-defaults-panel">
      <label>
        Tempo (BPM)
        <input
          id="project3d-sonic-tempo"
          type="number"
          min={40}
          max={220}
          value={current.tempo}
          onChange={(e) => update({ tempo: Number(e.target.value) })}
        />
      </label>
      <label>
        Root
        <select
          id="project3d-sonic-root"
          value={current.root}
          onChange={(e) => update({ root: e.target.value as SonicDefaults['root'] })}
        >
          {SONIC_ROOTS.map((root) => (
            <option key={root}>{root}</option>
          ))}
        </select>
      </label>
      <label>
        Scale
        <select
          id="project3d-sonic-scale"
          value={current.scale}
          onChange={(e) => update({ scale: e.target.value as SonicDefaults['scale'] })}
        >
          {SONIC_SCALES.map((scale) => (
            <option key={scale}>{scale}</option>
          ))}
        </select>
      </label>
      <label>
        Keyboard scale
        <select
          id="project3d-sonic-keyboard-scale"
          value={current.keyboard_scale}
          onChange={(e) =>
            update({ keyboard_scale: e.target.value as SonicDefaults['keyboard_scale'] })
          }
        >
          {SONIC_SCALES.map((scale) => (
            <option key={scale}>{scale}</option>
          ))}
        </select>
      </label>
      <label>
        Transpose (semitones)
        <input
          id="project3d-sonic-transpose"
          type="number"
          min={-12}
          max={12}
          value={current.transpose}
          onChange={(e) => update({ transpose: Number(e.target.value) })}
        />
      </label>
      <label>
        Instrument
        <select
          id="project3d-sonic-instrument"
          value={current.instrument}
          onChange={(e) => update({ instrument: e.target.value as SonicDefaults['instrument'] })}
        >
          {SONIC_INSTRUMENTS.map((instrument) => (
            <option key={instrument}>{instrument}</option>
          ))}
        </select>
      </label>
      <label>
        Default volume
        <input
          id="project3d-sonic-default-volume"
          type="range"
          min={0}
          max={100}
          value={current.extras.default_volume}
          onChange={(e) => updateExtras({ default_volume: Number(e.target.value) })}
        />
        <span>{current.extras.default_volume}%</span>
      </label>
      <label>
        Oscillator
        <select
          id="project3d-sonic-oscillator"
          value={current.extras.synth.oscillator}
          onChange={(e) =>
            updateSynth({
              oscillator: e.target.value as SonicDefaults['extras']['synth']['oscillator'],
            })
          }
        >
          {['sine', 'square', 'sawtooth', 'triangle'].map((wave) => (
            <option key={wave}>{wave}</option>
          ))}
        </select>
      </label>
      <label>
        Filter
        <select
          id="project3d-sonic-filter"
          value={current.extras.synth.filter_type}
          onChange={(e) =>
            updateSynth({
              filter_type: e.target.value as SonicDefaults['extras']['synth']['filter_type'],
            })
          }
        >
          {['lowpass', 'highpass', 'bandpass'].map((filter) => (
            <option key={filter}>{filter}</option>
          ))}
        </select>
      </label>
      <label>
        Filter cutoff
        <input
          id="project3d-sonic-filter-cutoff"
          type="number"
          min={20}
          max={20000}
          value={current.extras.synth.filter_cutoff}
          onChange={(e) => updateSynth({ filter_cutoff: Number(e.target.value) })}
        />
      </label>
      <label>
        Filter resonance
        <input
          id="project3d-sonic-filter-resonance"
          type="number"
          min={0.1}
          max={20}
          step={0.1}
          value={current.extras.synth.filter_resonance}
          onChange={(e) => updateSynth({ filter_resonance: Number(e.target.value) })}
        />
      </label>
      {(['attack', 'decay', 'sustain', 'release'] as const).map((name) => (
        <label key={name}>
          Envelope {name}
          <input
            id={`project3d-sonic-envelope-${name}`}
            type="number"
            min={0}
            max={name === 'sustain' ? 1 : 10}
            step={0.01}
            value={current.extras.synth.envelope[name]}
            onChange={(e) => updateEnvelope({ [name]: Number(e.target.value) })}
          />
        </label>
      ))}
      <label>
        Feel
        <input
          id="project3d-sonic-feel"
          maxLength={400}
          value={current.feel}
          onChange={(e) => update({ feel: e.target.value })}
        />
      </label>
    </div>
  );
}
