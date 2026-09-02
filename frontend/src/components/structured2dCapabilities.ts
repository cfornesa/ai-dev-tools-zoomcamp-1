import type { SceneDocument } from '../api/projects';

export type Structured2DCapabilities = {
  sound: boolean;
  voiceInput: boolean;
  microphone: boolean;
};

const DISABLED: Structured2DCapabilities = { sound: false, voiceInput: false, microphone: false };

/** Derives the finite structured-2D control contract from persisted scene data. */
export function deriveStructured2DCapabilities(
  scene: SceneDocument | null | undefined,
): Structured2DCapabilities {
  const value = scene?.runtimeCapabilities;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DISABLED;
  const capabilities = value as Record<string, unknown>;
  return {
    sound: capabilities.sound === true,
    voiceInput: capabilities.voiceInput === true,
    microphone: capabilities.microphone === true,
  };
}
