import { describe, expect, it } from 'vitest';

import enabledFixture from '../../../schema/fixtures/valid/structured_2d_sound_enabled.json';
import disabledFixture from '../../../schema/fixtures/valid/structured_2d_sound_disabled.json';
import { deriveStructured2DCapabilities } from './structured2dCapabilities';

describe('deriveStructured2DCapabilities', () => {
  it('returns only explicitly declared controls', () => {
    expect(deriveStructured2DCapabilities(enabledFixture)).toEqual({
      sound: true,
      voiceInput: true,
      microphone: true,
    });
  });

  it('disables every control when the declaration is absent or malformed', () => {
    expect(deriveStructured2DCapabilities(disabledFixture)).toEqual({
      sound: false,
      voiceInput: false,
      microphone: false,
    });
    expect(deriveStructured2DCapabilities({})).toEqual({
      sound: false,
      voiceInput: false,
      microphone: false,
    });
  });
});
