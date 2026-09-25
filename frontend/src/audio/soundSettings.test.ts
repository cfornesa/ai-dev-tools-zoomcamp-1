import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SOUND_SETTINGS,
  readSoundSettings,
  resetSoundSettings,
  soundSettingsKey,
  writeSoundSettings,
} from './soundSettings';

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
  it('uses the per-piece versioned key and round-trips valid settings', () => {
    const target = storage();
    const settings = { ...DEFAULT_SOUND_SETTINGS, ambientBpm: 120 };
    writeSoundSettings('piece-1', settings, target);

    expect(target.setItem).toHaveBeenCalledWith(
      soundSettingsKey('piece-1'),
      JSON.stringify(settings),
    );
    expect(readSoundSettings('piece-1', target)).toEqual(settings);
  });

  it('returns defaults for invalid or old-version data', () => {
    const invalid = storage(JSON.stringify({ ...DEFAULT_SOUND_SETTINGS, ambientBpm: 999 }));
    const old = storage(JSON.stringify({ ...DEFAULT_SOUND_SETTINGS, version: 0 }));

    expect(readSoundSettings('piece-1', invalid)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(readSoundSettings('piece-1', old)).toEqual(DEFAULT_SOUND_SETTINGS);
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
});
