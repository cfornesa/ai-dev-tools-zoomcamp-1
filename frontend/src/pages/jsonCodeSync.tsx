import { useEffect, useRef, useState } from 'react';

import type { SceneDocument } from '../api/projects';
import { validateScene } from '../validation/scene';

/**
 * Extracted from `EditorWorkspace.tsx` (issue #177's `useJsonCodeSync`,
 * unchanged) so issue #225's AI-assisted editor Code tab can reuse the
 * exact same JSON sub-tab sync strategy instead of reimplementing it.
 * See the manual editor's own doc comment (git history on this file) for
 * the full rationale; summarized: tracks `workingCopy` by identity, only
 * resyncs a clean (non-dirty) sub-tab, and flags `externalChangePending`
 * rather than silently overwriting an unsaved in-progress edit.
 */
export function codeDiagnostic(source: string, message: string): string {
  const positionMatch = message.match(/position\s+(\d+)/i);
  let offset = positionMatch ? Number(positionMatch[1]) : -1;
  if (offset < 0) {
    const fieldMatch = message.match(
      /(\$\.[^:; ]+)|(?:shape|layer|group|binding|node|connection)\s+"([^"]+)"/i,
    );
    const field =
      fieldMatch?.[2] ??
      fieldMatch?.[1]
        ?.split('.')
        .pop()
        ?.replaceAll('[', '')
        .replaceAll(']', '')
        .replace(/[0-9]/g, '');
    offset = field ? source.indexOf(field) : -1;
  }
  if (offset < 0) offset = 0;
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const lastNewline = before.lastIndexOf('\n');
  const column = offset - lastNewline;
  return `Line ${line}, column ${column}: ${message}`;
}

export function useJsonCodeSync(
  workingCopy: SceneDocument | null,
  onCommit: (scene: SceneDocument) => void,
) {
  const [text, setText] = useState(() => JSON.stringify(workingCopy, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [externalChangePending, setExternalChangePending] = useState(false);
  const textRef = useRef(text);
  const lastSyncedTextRef = useRef(text);
  const lastSyncedWorkingCopyRef = useRef(workingCopy);

  useEffect(() => {
    if (workingCopy === lastSyncedWorkingCopyRef.current) return;
    lastSyncedWorkingCopyRef.current = workingCopy;
    if (textRef.current !== lastSyncedTextRef.current) {
      setExternalChangePending(true);
      return;
    }
    const generated = JSON.stringify(workingCopy, null, 2);
    lastSyncedTextRef.current = generated;
    textRef.current = generated;
    setText(generated);
  }, [workingCopy]);

  function onChange(value: string) {
    textRef.current = value;
    setText(value);
  }

  function onReload() {
    const generated = JSON.stringify(workingCopy, null, 2);
    lastSyncedTextRef.current = generated;
    textRef.current = generated;
    lastSyncedWorkingCopyRef.current = workingCopy;
    setText(generated);
    setError(null);
    setExternalChangePending(false);
  }

  function onBlur() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(textRef.current);
    } catch (err) {
      setError(
        codeDiagnostic(
          textRef.current,
          `Invalid JSON: ${err instanceof Error ? err.message : 'could not parse this text.'}`,
        ),
      );
      return;
    }
    const result = validateScene(parsed);
    if (!result.valid) {
      setError(
        result.errors
          .map((e) => codeDiagnostic(textRef.current, `${e.path}: ${e.message}`))
          .join('; '),
      );
      return;
    }
    setError(null);
    onCommit(parsed as SceneDocument);
    const canonical = JSON.stringify(parsed, null, 2);
    lastSyncedTextRef.current = canonical;
    textRef.current = canonical;
    lastSyncedWorkingCopyRef.current = parsed as SceneDocument;
    setText(canonical);
    setExternalChangePending(false);
  }

  return { text, error, externalChangePending, onChange, onBlur, onReload };
}

export type JsonCodeSync = ReturnType<typeof useJsonCodeSync>;

/** Extracted from `EditorWorkspace.tsx` (issue #159, unchanged) -- purely
 * presentational, all sync state/logic lives in `useJsonCodeSync` above.
 * Reused as-is by issue #225's AI-assisted editor Code tab. */
export function SceneCodeEditor({ sync }: { sync: JsonCodeSync }) {
  const { text, error, externalChangePending, onChange, onBlur, onReload } = sync;

  return (
    <div className="editor-code-tab">
      <label htmlFor="editor-scene-code-textarea">Scene JSON</label>
      <textarea
        id="editor-scene-code-textarea"
        data-testid="editor-scene-code-textarea"
        className="editor-scene-code-textarea"
        spellCheck={false}
        rows={24}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85em' }}
        value={text}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'editor-scene-code-error' : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {error && (
        <p id="editor-scene-code-error" role="alert" aria-live="assertive">
          Invalid scene JSON — not applied: {error}
        </p>
      )}
      {externalChangePending && (
        <p
          id="editor-scene-code-external-change"
          role="alert"
          aria-live="assertive"
          className="editor-code-external-change-notice"
        >
          This tab&apos;s content changed elsewhere (e.g. Undo/Redo) while you had an unsaved edit
          here — your edit was kept.{' '}
          <button type="button" data-testid="editor-scene-code-reload" onClick={onReload}>
            Discard my edit and reload
          </button>
        </p>
      )}
    </div>
  );
}
