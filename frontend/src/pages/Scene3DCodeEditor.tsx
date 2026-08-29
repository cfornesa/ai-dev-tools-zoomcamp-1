import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../api/client';
import { saveSceneVersion3D, type SceneVersion3D } from '../api/projects3d';
import { validateScene3D } from '../validation/scene3d';
import { codeDiagnostic } from './jsonCodeSync';
import type { Scene3DDocument } from './scene3dTypes';

type Props = {
  projectId: string;
  scene: Scene3DDocument;
  /** Called only after a save actually persisted -- the caller updates its
   * own working scene/project state from the returned version, matching
   * `AiEditorWorkspace.tsx`'s `handleAccepted` convention. */
  onSaved: (version: SceneVersion3D) => void;
};

type SaveState = { pending: boolean; error: string | null };

const IDLE_SAVE_STATE: SaveState = { pending: false, error: null };

/**
 * Issue #229: the 3D manual editor's Code tab -- JSON only for this first
 * slice (a code-grammar view is explicitly a nice-to-have, not required,
 * per the issue). Unlike the 2D editor's Code tab (jsonCodeSync.tsx,
 * memory-only), an edit here validates via the client `validateScene3D`
 * mirror AND saves through #228's endpoint on blur, per this issue's own
 * explicit requirement -- there is no separate "Save" action for this
 * tab. Text resyncs from `scene` only while the tab has no unsaved edit
 * pending, mirroring jsonCodeSync.tsx's dirty-tracking strategy.
 */
function Scene3DCodeEditor({ projectId, scene, onSaved }: Props) {
  const [text, setText] = useState(() => JSON.stringify(scene, null, 2));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(IDLE_SAVE_STATE);
  const textRef = useRef(text);
  const lastSyncedTextRef = useRef(text);
  const lastSyncedSceneRef = useRef(scene);

  useEffect(() => {
    if (scene === lastSyncedSceneRef.current) return;
    lastSyncedSceneRef.current = scene;
    if (textRef.current !== lastSyncedTextRef.current) return; // dirty, leave it
    const generated = JSON.stringify(scene, null, 2);
    lastSyncedTextRef.current = generated;
    textRef.current = generated;
    setText(generated);
  }, [scene]);

  function onChange(value: string) {
    textRef.current = value;
    setText(value);
  }

  async function onBlur() {
    if (textRef.current === lastSyncedTextRef.current) return; // nothing changed
    let parsed: unknown;
    try {
      parsed = JSON.parse(textRef.current);
    } catch (err) {
      setValidationError(
        codeDiagnostic(
          textRef.current,
          `Invalid JSON: ${err instanceof Error ? err.message : 'could not parse this text.'}`,
        ),
      );
      return;
    }
    const result = validateScene3D(parsed);
    if (!result.valid) {
      setValidationError(
        result.errors
          .map((e) => codeDiagnostic(textRef.current, `${e.path}: ${e.message}`))
          .join('; '),
      );
      return;
    }
    setValidationError(null);
    setSaveState({ pending: true, error: null });
    try {
      const version = await saveSceneVersion3D(projectId, parsed as Scene3DDocument);
      setSaveState(IDLE_SAVE_STATE);
      const canonical = JSON.stringify(version.scene_json, null, 2);
      lastSyncedTextRef.current = canonical;
      textRef.current = canonical;
      lastSyncedSceneRef.current = version.scene_json as unknown as Scene3DDocument;
      setText(canonical);
      onSaved(version);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? 'This edit could not be saved. Check the scene document and try again.'
          : 'Something went wrong saving this edit. Please try again.';
      setSaveState({ pending: false, error: message });
    }
  }

  return (
    <div className="editor-code-tab">
      <label htmlFor="scene3d-code-textarea">Scene3D JSON</label>
      <textarea
        id="scene3d-code-textarea"
        data-testid="scene3d-code-textarea"
        spellCheck={false}
        rows={24}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85em' }}
        value={text}
        disabled={saveState.pending}
        aria-invalid={validationError ? true : undefined}
        aria-describedby={validationError ? 'scene3d-code-error' : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => void onBlur()}
      />
      {saveState.pending && (
        <p role="status" aria-live="polite">
          Saving…
        </p>
      )}
      {validationError && (
        <p id="scene3d-code-error" role="alert" aria-live="assertive">
          Invalid scene JSON — not saved: {validationError}
        </p>
      )}
      {saveState.error && (
        <p role="alert" aria-live="assertive">
          {saveState.error}
        </p>
      )}
    </div>
  );
}

export default Scene3DCodeEditor;
