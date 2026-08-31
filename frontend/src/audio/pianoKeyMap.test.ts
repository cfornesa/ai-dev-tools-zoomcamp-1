import { describe, expect, it } from 'vitest';

import { isEditableElement, PIANO_KEY_MAP } from './pianoKeyMap';

describe('PIANO_KEY_MAP', () => {
  it('maps the ASDF home row to a chromatic run of notes', () => {
    expect(PIANO_KEY_MAP.a).toBe('C4');
    expect(PIANO_KEY_MAP.w).toBe('C#4');
    expect(PIANO_KEY_MAP.s).toBe('D4');
    expect(PIANO_KEY_MAP[';']).toBe('E5');
  });

  it('has no duplicate notes across keys', () => {
    const notes = Object.values(PIANO_KEY_MAP);
    expect(new Set(notes).size).toBe(notes.length);
  });
});

describe('isEditableElement', () => {
  it('is true for input/textarea/select/contenteditable', () => {
    expect(isEditableElement(document.createElement('input'))).toBe(true);
    expect(isEditableElement(document.createElement('textarea'))).toBe(true);
    expect(isEditableElement(document.createElement('select'))).toBe(true);
    const el = document.createElement('div');
    Object.defineProperty(el, 'isContentEditable', { value: true });
    expect(isEditableElement(el)).toBe(true);
  });

  it('is false for a plain div/button, and for null', () => {
    expect(isEditableElement(document.createElement('div'))).toBe(false);
    expect(isEditableElement(document.createElement('button'))).toBe(false);
    expect(isEditableElement(null)).toBe(false);
  });
});
