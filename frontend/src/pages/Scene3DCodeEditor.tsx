import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../api/client';
import {
  saveSceneVersion3D,
  type SceneVersion3D,
  type SceneVersion3DSourceInput,
} from '../api/projects3d';
import { validateScene3D } from '../validation/scene3d';
import { codeDiagnostic } from './jsonCodeSync';
import type { Scene3DDocument } from './scene3dTypes';
import {
  generateEditable3dCss,
  generateEditable3dHtml,
  generateEditable3dJs,
  parseEditable3dCss,
  parseEditable3dHtml,
  parseEditable3dJs,
} from '../export/codeGrammar3dTabs';

type Props = {
  projectId?: string;
  scene: Scene3DDocument;
  sources?: SceneVersion3DSourceInput;
  /** Called only after a save actually persisted -- the caller updates its
   * own working scene/project state from the returned version, matching
   * `AiEditorWorkspace.tsx`'s `handleAccepted` convention. */
  onSaved?: (version: SceneVersion3D) => void;
  /** Project3DWorkspace mode: apply parsed edits to its working scene. */
  onChange?: (scene: Scene3DDocument) => void;
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
function LegacyScene3DCodeEditor({ projectId, scene, onSaved }: Props) {
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
      if (!projectId || !onSaved) return;
      const savedScene = parsed as Scene3DDocument;
      const version = await saveSceneVersion3D(projectId, savedScene, {
        html_source: generateEditable3dHtml(savedScene),
        css_source: generateEditable3dCss(savedScene),
        js_source: generateEditable3dJs(savedScene),
      });
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

type CodeTab = 'json' | 'html' | 'css' | 'js';

function generateWorkspaceCode(scene: Scene3DDocument, sources?: SceneVersion3DSourceInput) {
  let css = '';
  try {
    css = generateEditable3dCss(scene);
  } catch {
    // Keep the code panel usable while an older/incomplete fixture is being
    // replaced by the canonical validated scene. Saving still goes through
    // the same validator and never accepts this fallback as a scene.
  }
  return {
    json: JSON.stringify(scene, null, 2),
    html: sources?.html_source || generateEditable3dHtml(scene),
    css: sources?.css_source || css,
    js: sources?.js_source || generateEditable3dJs(scene),
  };
}

function Scene3DWorkspaceCodeEditor({
  scene,
  sources,
  onChange,
}: Pick<Props, 'scene' | 'sources' | 'onChange'>) {
  const [tab, setTab] = useState<CodeTab>('json');
  const generated = generateWorkspaceCode(scene, sources);
  const [texts, setTexts] = useState(generated);
  const [baseline, setBaseline] = useState(generated);
  const [externalChangePending, setExternalChangePending] = useState(false);
  const [errors, setErrors] = useState<string[] | null>(null);
  const lastSceneRef = useRef(scene);

  useEffect(() => {
    if (scene === lastSceneRef.current) return;
    lastSceneRef.current = scene;
    const next = generateWorkspaceCode(scene);
    const dirty = (Object.keys(texts) as CodeTab[]).some((key) => texts[key] !== baseline[key]);
    setTexts((current) => {
      const updated = { ...current };
      (Object.keys(updated) as CodeTab[]).forEach((key) => {
        if (current[key] === baseline[key]) updated[key] = next[key];
      });
      return updated;
    });
    setBaseline((current) => {
      const updated = { ...current };
      (Object.keys(updated) as CodeTab[]).forEach((key) => {
        if (texts[key] === baseline[key]) updated[key] = next[key];
      });
      return updated;
    });
    setExternalChangePending(dirty);
  }, [scene, texts, baseline]);

  function applyText(key: CodeTab, value: string) {
    setTexts((current) => ({ ...current, [key]: value }));
  }

  function reload() {
    const next = generateWorkspaceCode(scene);
    setTexts(next);
    setBaseline(next);
    setExternalChangePending(false);
    setErrors(null);
  }

  function save() {
    let result: ReturnType<typeof parseEditable3dHtml> | ReturnType<typeof parseEditable3dJs>;
    if (tab === 'json') {
      try {
        const parsed = JSON.parse(texts.json);
        const validation = validateScene3D(parsed);
        if (!validation.valid) {
          setErrors(validation.errors.map((error) => `${error.path}: ${error.message}`));
          return;
        }
        onChange?.(parsed as Scene3DDocument);
        const next = generateWorkspaceCode(parsed as Scene3DDocument);
        setTexts((current) => ({ ...current, json: next.json }));
        setBaseline((current) => ({ ...current, json: next.json }));
        setExternalChangePending(false);
        setErrors(null);
        return;
      } catch (error) {
        setErrors([
          `Line 1: Invalid JSON: ${error instanceof Error ? error.message : 'could not parse this text.'}`,
        ]);
        return;
      }
    } else if (tab === 'html' || tab === 'css') {
      result =
        tab === 'html'
          ? parseEditable3dHtml(texts.html, scene)
          : parseEditable3dCss(texts.css, scene);
    } else {
      result = parseEditable3dJs(texts.js, scene);
    }
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onChange?.(result.scene);
    const next = generateWorkspaceCode(result.scene);
    setTexts((current) => ({ ...current, [tab]: next[tab] }));
    setBaseline((current) => ({ ...current, [tab]: next[tab] }));
    setExternalChangePending(false);
    setErrors(null);
  }

  const value = texts[tab];
  return (
    <div className="editor-code-tab" data-testid="scene3d-code-editor">
      <div role="tablist" aria-label="3D code sub-tabs">
        {(['json', 'html', 'css', 'js'] as CodeTab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {key.toUpperCase()}
          </button>
        ))}
      </div>
      <label htmlFor={`scene3d-code-${tab}`}>
        {tab === 'json' ? 'Scene3D JSON' : `Scene3D ${tab.toUpperCase()}`}
      </label>
      <textarea
        id={`scene3d-code-${tab}`}
        data-testid={`scene3d-code-${tab}`}
        spellCheck={false}
        rows={24}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85em' }}
        value={value}
        onChange={(event) => applyText(tab, event.target.value)}
      />
      <button type="button" onClick={save}>
        Apply {tab.toUpperCase()} changes
      </button>
      {externalChangePending && (
        <p role="alert">
          This tab&apos;s content changed elsewhere while you had an unsaved edit.{' '}
          <button type="button" onClick={reload}>
            Discard my edit and reload
          </button>
        </p>
      )}
      {errors && (
        <p role="alert" aria-live="assertive">
          Invalid {tab.toUpperCase()} — not applied: {errors.join('; ')}
        </p>
      )}
    </div>
  );
}

function Scene3DCodeEditor(props: Props) {
  return props.onChange ? (
    <Scene3DWorkspaceCodeEditor scene={props.scene} onChange={props.onChange} />
  ) : (
    <LegacyScene3DCodeEditor {...props} />
  );
}

export default Scene3DCodeEditor;
