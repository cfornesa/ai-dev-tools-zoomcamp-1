export type VisitorHistory<T> = {
  past: T[][];
  present: T[];
  future: T[][];
};

export function createVisitorHistory<T>(present: T[] = []): VisitorHistory<T> {
  return { past: [], present, future: [] };
}

export function commitVisitorHistory<T>(
  history: VisitorHistory<T>,
  present: T[],
): VisitorHistory<T> {
  return { past: [...history.past, history.present], present, future: [] };
}

export function undoVisitorHistory<T>(history: VisitorHistory<T>): VisitorHistory<T> {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoVisitorHistory<T>(history: VisitorHistory<T>): VisitorHistory<T> {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
