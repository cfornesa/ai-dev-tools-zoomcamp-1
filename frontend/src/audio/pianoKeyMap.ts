/**
 * Issue #307: the standard "computer-keyboard piano" ASDF-row mapping the
 * reference implementation uses (confirmed directly in
 * `augment-humankind`'s `sonic-controller.js`: `attachPianoKeyListener`
 * binds a standard ASDF-piano-key layout, not a bespoke one) -- a home-row
 * run of white keys with the row above supplying the interleaved black
 * keys, the same convention widely used by other browser "keyboard piano"
 * tools.
 */
export const PIANO_KEY_MAP: Record<string, string> = {
  a: 'C4',
  w: 'C#4',
  s: 'D4',
  e: 'D#4',
  d: 'E4',
  f: 'F4',
  t: 'F#4',
  g: 'G4',
  y: 'G#4',
  h: 'A4',
  u: 'A#4',
  j: 'B4',
  k: 'C5',
  o: 'C#5',
  l: 'D5',
  p: 'D#5',
  ';': 'E5',
};

/** True for the class of elements a global keyboard-piano listener must
 * never fire over -- typing in a form field elsewhere on the page should
 * never be interpreted as playing notes. */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target.isContentEditable)
  );
}
