import { describe, expect, it } from 'vitest';

import {
  commitVisitorHistory,
  createVisitorHistory,
  redoVisitorHistory,
  undoVisitorHistory,
} from './visitorDrawingHistory';

describe('visitor drawing history', () => {
  it('undoes and redoes strokes and clears the redo stack after a new commit', () => {
    let history = createVisitorHistory<string>();
    history = commitVisitorHistory(history, ['pencil']);
    history = commitVisitorHistory(history, ['pencil', 'brush']);
    history = undoVisitorHistory(history);
    expect(history.present).toEqual(['pencil']);
    history = redoVisitorHistory(history);
    expect(history.present).toEqual(['pencil', 'brush']);
    history = undoVisitorHistory(history);
    history = commitVisitorHistory(history, ['pencil', 'eraser']);
    expect(redoVisitorHistory(history)).toEqual(history);
  });

  it('makes clear undoable', () => {
    let history = createVisitorHistory(['mark']);
    history = commitVisitorHistory(history, []);
    expect(history.present).toEqual([]);
    expect(undoVisitorHistory(history).present).toEqual(['mark']);
  });
});
