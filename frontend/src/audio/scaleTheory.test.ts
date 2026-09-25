import { describe, expect, it } from 'vitest';

import {
  identifyScale,
  noteInScale,
  scaleNotes,
  SCALE_INTERVALS,
  snapToScale,
  transposeNote,
} from './scaleTheory';

describe('scale theory', () => {
  it('keeps the nine reference interval tables', () => {
    expect(SCALE_INTERVALS.major).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(SCALE_INTERVALS.minor).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(SCALE_INTERVALS.pentatonic).toEqual([0, 3, 5, 7, 10]);
    expect(SCALE_INTERVALS.chromatic).toEqual([...Array(12).keys()]);
    expect(SCALE_INTERVALS.dorian).toEqual([0, 2, 3, 5, 7, 9, 10]);
    expect(SCALE_INTERVALS.phrygian).toEqual([0, 1, 3, 5, 7, 8, 10]);
    expect(SCALE_INTERVALS.lydian).toEqual([0, 2, 4, 6, 7, 9, 11]);
    expect(SCALE_INTERVALS.mixolydian).toEqual([0, 2, 4, 5, 7, 9, 10]);
    expect(SCALE_INTERVALS.wholetone).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('generates notes and accepts flat spellings consistently', () => {
    expect(scaleNotes('C', 'major', [4, 4])).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']);
    expect(noteInScale('Db4', 'C#', 'major')).toBe(true);
    expect(noteInScale('Db4', 'C#', 'minor')).toBe(true);
  });

  it('snaps down on ties and preserves the input octave range', () => {
    expect(snapToScale('F#4', 'C', 'major')).toBe('F4');
    expect(snapToScale('C4', 'C', 'major')).toBe('C4');
  });

  it('transposes with MIDI-equivalent pitch math', () => {
    expect(transposeNote('C4', 14)).toBe('D5');
    expect(transposeNote('C4', -13)).toBe('B2');
  });

  it('ranks full and pentatonic scale matches deterministically', () => {
    expect(identifyScale(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'])[0]).toEqual({
      root: 'C',
      scale: 'major',
      coverage: 1,
    });
    expect(identifyScale(['A3', 'C4', 'D4', 'E4', 'G4']).filter((match) => match.coverage === 1)).toEqual(
      expect.arrayContaining([{ root: 'A', scale: 'minor', coverage: 1 }]),
    );
    expect(identifyScale(['C4', 'C#4'])).toEqual([]);
  });
});
