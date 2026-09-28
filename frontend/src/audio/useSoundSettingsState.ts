import { useState } from 'react';

import type { SoundSettings } from './soundSettings';

export type SharedSoundSettings = Pick<
  SoundSettings,
  | 'soundVolume'
  | 'ambientBpm'
  | 'ambientVolume'
  | 'ambientMuted'
  | 'ambientScale'
  | 'keyboardRoot'
  | 'keyboardScale'
  | 'keyboardTranspose'
  | 'followKey'
  | 'keyboardEnabled'
  | 'keyboardVolume'
>;

export function useSoundSettingsState(initial: SharedSoundSettings) {
  const [soundVolume, setSoundVolume] = useState(initial.soundVolume);
  const [ambientBpm, setAmbientBpm] = useState(initial.ambientBpm);
  const [ambientVolume, setAmbientVolume] = useState(initial.ambientVolume);
  const [ambientMuted, setAmbientMuted] = useState(initial.ambientMuted);
  const [ambientScale, setAmbientScale] = useState(initial.ambientScale);
  const [keyboardRoot, setKeyboardRoot] = useState(initial.keyboardRoot);
  const [keyboardScale, setKeyboardScale] = useState(initial.keyboardScale);
  const [keyboardTranspose, setKeyboardTranspose] = useState(initial.keyboardTranspose);
  const [followKey, setFollowKey] = useState(initial.followKey);
  const [keyboardEnabled, setKeyboardEnabled] = useState(initial.keyboardEnabled);
  const [keyboardVolume, setKeyboardVolume] = useState(initial.keyboardVolume);

  return {
    soundVolume,
    setSoundVolume,
    ambientBpm,
    setAmbientBpm,
    ambientVolume,
    setAmbientVolume,
    ambientMuted,
    setAmbientMuted,
    ambientScale,
    setAmbientScale,
    keyboardRoot,
    setKeyboardRoot,
    keyboardScale,
    setKeyboardScale,
    keyboardTranspose,
    setKeyboardTranspose,
    followKey,
    setFollowKey,
    keyboardEnabled,
    setKeyboardEnabled,
    keyboardVolume,
    setKeyboardVolume,
  };
}
