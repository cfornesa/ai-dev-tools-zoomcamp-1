import { describe, expect, it, vi } from 'vitest';

import {
  applySoundSettingsToEngine,
  authoredSoundHash,
  DEFAULT_SOUND_SETTINGS,
  readSoundSettings,
  resetSoundSettings,
  soundSettingsFromSonic,
  soundSettingsKey,
  writeSoundSettings,
} from './soundSettings';
import type { SonicEngine } from './sonicEngine';

function engineSpy() {
  return {
    setVolume: vi.fn(),
    setTempo: vi.fn(),
    setVoiceVolume: vi.fn(),
    setVoiceMuted: vi.fn(),
    setScale: vi.fn(() => true),
    setKey: vi.fn(() => true),
    setTranspose: vi.fn(),
    setFollowKey: vi.fn(),
    setFilter: vi.fn(() => true),
    setMelodicSynth: vi.fn(),
  } as unknown as SonicEngine;
}
import { normalizeSonic } from './sonicContract';

function storage(initial?: string): Storage {
  let value = initial ?? null;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => {
      value = next;
    }),
    removeItem: vi.fn(() => {
      value = null;
    }),
    clear: vi.fn(),
    key: vi.fn(() => null),
    get length() {
      return value === null ? 0 : 1;
    },
  };
}

describe('soundSettings', () => {
  it('applies reset settings to an active engine, not only to controls/storage', () => {
    const engine = engineSpy();
    const settings = {
      ...DEFAULT_SOUND_SETTINGS,
      ambientBpm: 90,
      ambientScale: 'major' as const,
    };

    applySoundSettingsToEngine(engine, settings);

    expect(engine.setTempo).toHaveBeenCalledWith(90);
    expect(engine.setScale).toHaveBeenCalledWith('major');
    expect(engine.setKey).toHaveBeenCalledWith({ root: 'C', scale: 'major' });
    expect(engine.setTranspose).toHaveBeenCalledWith(0);
    expect(engine.setVoiceMuted).toHaveBeenCalledWith('ambient', false);
    expect(engine.setMelodicSynth).toHaveBeenCalledWith(
      expect.objectContaining({ oscillator: 'sine', octaveShift: 0 }),
    );
  });

  it('stores only authored-tagged visitor overrides and round-trips them', () => {
    const target = storage();
    const settings = { ...DEFAULT_SOUND_SETTINGS, ambientBpm: 120 };
    writeSoundSettings('piece-1', settings, target);

    expect(JSON.parse(target.getItem(soundSettingsKey('piece-1'))!)).toEqual({
      v: 2,
      authoredHash: authoredSoundHash(DEFAULT_SOUND_SETTINGS),
      overrides: { ambientBpm: 120 },
    });
    expect(readSoundSettings('piece-1', target)).toEqual(settings);
  });

  it('rejects a version-2 record tagged for an older authored version', () => {
    const target = storage(
      JSON.stringify({
        v: 2,
        authoredHash: 'stale',
        overrides: { ambientScale: 'minor' },
      }),
    );

    expect(readSoundSettings('piece-1', target)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(target.removeItem).toHaveBeenCalledWith(soundSettingsKey('piece-1'));
  });

  it('migrates legacy snapshots while dropping old defaults that mask authored values', () => {
    const authored = { ...DEFAULT_SOUND_SETTINGS, ambientScale: 'major' as const };
    const target = storage(
      JSON.stringify({
        ...DEFAULT_SOUND_SETTINGS,
        version: 1,
        ambientScale: 'pentatonic',
        ambientBpm: 120,
      }),
    );

    expect(readSoundSettings('piece-1', target, authored)).toMatchObject({
      ambientScale: 'major',
      ambientBpm: 120,
    });
    expect(JSON.parse(target.getItem(soundSettingsKey('piece-1'))!)).toEqual({
      v: 2,
      authoredHash: authoredSoundHash(authored),
      overrides: { ambientBpm: 120 },
    });
  });

  it('returns defaults for invalid data', () => {
    const invalid = storage(JSON.stringify({ ...DEFAULT_SOUND_SETTINGS, ambientBpm: 999 }));

    expect(readSoundSettings('piece-1', invalid)).toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('survives malformed JSON and storage failures', () => {
    expect(readSoundSettings('piece-1', storage('{'))).toEqual(DEFAULT_SOUND_SETTINGS);
    const broken = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      removeItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    } as unknown as Storage;

    expect(readSoundSettings('piece-1', broken)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(() => writeSoundSettings('piece-1', DEFAULT_SOUND_SETTINGS, broken)).not.toThrow();
    expect(() => resetSoundSettings('piece-1', broken)).not.toThrow();
  });

  it('reset clears only the requested piece key and returns defaults', () => {
    const target = storage(JSON.stringify(DEFAULT_SOUND_SETTINGS));
    expect(resetSoundSettings('piece-1', target)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(target.removeItem).toHaveBeenCalledWith(soundSettingsKey('piece-1'));
  });

  it('maps authored sonic defaults into the visitor runtime baseline', () => {
    const sonic = normalizeSonic({
      tempo: 120,
      root: 'D',
      scale: 'major',
      keyboard_scale: 'dorian',
      transpose: 3,
      follow_key: true,
      extras: {
        default_volume: 64,
        synth: {
          oscillator: 'square',
          filter_type: 'highpass',
          filter_cutoff: 900,
          envelope: { attack: 0.2, decay: 0.4, sustain: 0.6, release: 0.8 },
        },
      },
    });
    expect(soundSettingsFromSonic(sonic)).toMatchObject({
      soundVolume: 0.64,
      ambientBpm: 120,
      ambientScale: 'major',
      keyboardRoot: 'D',
      keyboardScale: 'dorian',
      keyboardTranspose: 3,
      followKey: true,
      keyboardVolume: 64,
      keyboardOscillator: 'square',
      keyboardFilterType: 'highpass',
      keyboardFilterCutoff: 900,
      keyboardAttack: 0.2,
      keyboardRelease: 0.8,
      keyboardOctave: 0,
    });
  });
});
