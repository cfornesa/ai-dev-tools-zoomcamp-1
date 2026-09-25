export const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 3, 5, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  wholetone: [0, 2, 4, 6, 8, 10],
} as const;

export type ScaleName = keyof typeof SCALE_INTERVALS;
export type PitchClass =
  | 'C'
  | 'C#'
  | 'D'
  | 'D#'
  | 'E'
  | 'F'
  | 'F#'
  | 'G'
  | 'G#'
  | 'A'
  | 'A#'
  | 'B';

export const PITCH_CLASSES: readonly PitchClass[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

const FLAT_TO_SHARP: Record<string, PitchClass> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};

const SCALE_ORDER = Object.keys(SCALE_INTERVALS) as ScaleName[];

function pitchClassIndex(value: string): number {
  const normalized = FLAT_TO_SHARP[value] ?? value;
  return PITCH_CLASSES.indexOf(normalized as PitchClass);
}

function parseNote(note: string): { midi: number; pitchClass: number; octave: number } | null {
  const match = /^([A-Ga-g](?:#|b)?)(-?\d+)$/.exec(note.trim());
  if (!match) return null;
  const pitchClass = pitchClassIndex(match[1][0].toUpperCase() + match[1].slice(1));
  const octave = Number(match[2]);
  if (pitchClass < 0 || !Number.isInteger(octave)) return null;
  return { midi: (octave + 1) * 12 + pitchClass, pitchClass, octave };
}

function noteName(midi: number): string {
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  return `${PITCH_CLASSES[((rounded % 12) + 12) % 12]}${octave}`;
}

export function scaleNotes(root: PitchClass, scale: ScaleName, octaveRange: [number, number]): string[] {
  const rootIndex = pitchClassIndex(root);
  const intervals = SCALE_INTERVALS[scale];
  if (rootIndex < 0 || octaveRange.length !== 2) return [];
  const [startOctave, endOctave] = octaveRange;
  if (!Number.isInteger(startOctave) || !Number.isInteger(endOctave) || startOctave > endOctave) {
    return [];
  }
  const notes: string[] = [];
  for (let octave = startOctave; octave <= endOctave; octave += 1) {
    const rootMidi = (octave + 1) * 12 + rootIndex;
    for (const interval of intervals) notes.push(noteName(rootMidi + interval));
  }
  return notes;
}

export function noteInScale(note: string, root: PitchClass, scale: ScaleName): boolean {
  const parsed = parseNote(note);
  const rootIndex = pitchClassIndex(root);
  if (!parsed || rootIndex < 0) return false;
  return (SCALE_INTERVALS[scale] as readonly number[]).includes(
    (parsed.pitchClass - rootIndex + 12) % 12,
  );
}

export function snapToScale(note: string, root: PitchClass, scale: ScaleName): string {
  const parsed = parseNote(note);
  if (!parsed || pitchClassIndex(root) < 0) return note;
  for (let offset = 0; offset <= 11; offset += 1) {
    const down = parsed.midi - offset;
    if (noteInScale(noteName(down), root, scale)) return noteName(down);
  }
  return note;
}

export function transposeNote(note: string, semitones: number): string {
  const parsed = parseNote(note);
  if (!parsed || !Number.isFinite(semitones)) return note;
  return noteName(parsed.midi + semitones);
}

export type ScaleMatch = { root: PitchClass; scale: ScaleName; coverage: number };

export function identifyScale(notes: string[]): ScaleMatch[] {
  const pitchClasses = [...new Set(notes.map(parseNote).filter(Boolean).map((note) => note!.pitchClass))];
  if (pitchClasses.length < 3) return [];
  const matches: ScaleMatch[] = [];
  PITCH_CLASSES.forEach((root, rootIndex) => {
    SCALE_ORDER.forEach((scale, scaleIndex) => {
      const intervals = SCALE_INTERVALS[scale];
      const covered = pitchClasses.filter((pitchClass) =>
        (intervals as readonly number[]).includes((pitchClass - rootIndex + 12) % 12),
      ).length;
      matches.push({ root, scale, coverage: covered / pitchClasses.length });
      // Retain the declaration index as a stable tie-breaker without exposing it.
      void scaleIndex;
    });
  });
  return matches
    .filter((match) => match.coverage > 0)
    .sort((left, right) => {
      if (right.coverage !== left.coverage) return right.coverage - left.coverage;
      const sizeDifference =
        SCALE_INTERVALS[left.scale].length - SCALE_INTERVALS[right.scale].length;
      if (sizeDifference !== 0) return sizeDifference;
      return PITCH_CLASSES.indexOf(left.root) - PITCH_CLASSES.indexOf(right.root);
    });
}
