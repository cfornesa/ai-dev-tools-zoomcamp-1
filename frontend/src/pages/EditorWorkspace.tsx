import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import EditorPanelSwitcher, { type EditorPanelName } from '../components/EditorPanelSwitcher';
import { hitTestTopmostShapeAt, shapeLabel, type Shape, type ShapeType } from './sceneShapes';
import { useEditorWorkspaceState } from './useEditorWorkspaceState';
import { useIsNarrowViewport } from './useIsNarrowViewport';
import { useSceneEditor } from './useSceneEditor';
import SceneOutlinePanel from './SceneOutlinePanel';

const SHAPE_TYPES: Array<{ type: ShapeType; label: string }> = [
  { type: 'circle', label: 'Add circle' },
  { type: 'rect', label: 'Add rectangle' },
  { type: 'line', label: 'Add line' },
  { type: 'path', label: 'Add polygon' },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Task 21: the three-panel editor workspace shell. Loads the project and
 * its current scene version into a working copy on mount, then renders
 * three landmark regions (Tools, Preview, Inspector) side by side at
 * >=1024px, or one at a time behind a keyboard-operable switcher below
 * that.
 *
 * Task 23 adds shape add/select/duplicate/delete on top of that shell, via
 * `useSceneEditor` (state) and `sceneShapes` (data helpers): the Tools
 * panel gets add/duplicate/delete/undo/redo controls plus a keyboard-
 * operable shape list, and the Preview panel gets a placeholder canvas
 * surface shapes can be pointer-clicked on to select (real p5.js rendering
 * is Task 25; transform handles are Task 26; style editing is Task 60).
 */
function EditorWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { loadState, project, workingCopy, setWorkingCopy, retry } = useEditorWorkspaceState(id);
  const isNarrow = useIsNarrowViewport();
  const [activePanel, setActivePanel] = useState<EditorPanelName>('preview');
  const sceneEditor = useSceneEditor(workingCopy, setWorkingCopy);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes — the standard
  // shortcuts for this editor's in-session undo/redo policy (see
  // useSceneEditor.ts for the full policy writeup). Ignored while typing in
  // a text field so it doesn't fight the browser's own undo there.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        sceneEditor.redo();
      } else if (key === 'z') {
        event.preventDefault();
        sceneEditor.undo();
      } else if (key === 'y') {
        event.preventDefault();
        sceneEditor.redo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sceneEditor]);

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading editor…
      </p>
    );
  }

  if (loadState === 'access-denied') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          You don't have access to this project.
        </p>
        <p>
          <Link to="/">Back to your projects</Link>
        </p>
      </div>
    );
  }

  if (loadState === 'no-scene') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          This project has no valid scene to load.
        </p>
        <p>
          <Link to="/">Back to your projects</Link>
        </p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          Something went wrong loading this project. Please try again.
        </p>
        <button type="button" onClick={() => retry()}>
          Retry
        </button>
      </div>
    );
  }

  const shapeCount = Array.isArray(workingCopy?.shapes) ? workingCopy.shapes.length : 0;
  const canvas = (workingCopy?.canvas as { width?: number; height?: number } | undefined) ?? {
    width: 800,
    height: 600,
  };
  const canvasWidth = canvas.width ?? 800;
  const canvasHeight = canvas.height ?? 600;

  function panelHidden(panel: EditorPanelName): boolean {
    return isNarrow && activePanel !== panel;
  }

  function handleCanvasClick(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = hitTestTopmostShapeAt(sceneEditor.shapes, x, y);
    sceneEditor.selectShape(hit ? hit.id : null);
  }

  function shapeSummary(shape: Shape): string {
    switch (shape.type) {
      case 'circle':
        return `x=${shape.transform.x}, y=${shape.transform.y}, r=${shape.radius}`;
      case 'rect':
        return `x=${shape.transform.x}, y=${shape.transform.y}, w=${shape.width}, h=${shape.height}`;
      case 'line':
        return `(${shape.transform.x}, ${shape.transform.y}) -> (${shape.x2}, ${shape.y2})`;
      case 'path':
        return `${shape.points.length} point(s), closed=${shape.closed}`;
    }
  }

  return (
    <div>
      <header className="editor-workspace-header">
        <h2>{project?.title}</h2>
        <Link to={`/projects/${id}/settings`}>Edit project details</Link>
      </header>

      {isNarrow && <EditorPanelSwitcher activePanel={activePanel} onSelect={setActivePanel} />}

      <div className="editor-workspace">
        <section
          role="region"
          aria-label="Tools"
          data-panel="tools"
          id="editor-panel-tools"
          className="editor-panel"
          hidden={panelHidden('tools')}
        >
          <h3>Tools</h3>
          <div role="group" aria-label="Add shape" className="editor-tool-group">
            {SHAPE_TYPES.map(({ type, label }) => (
              <button key={type} type="button" onClick={() => sceneEditor.addShape(type)}>
                {label}
              </button>
            ))}
          </div>

          <div role="group" aria-label="Edit shape" className="editor-tool-group">
            <button
              type="button"
              onClick={() => sceneEditor.duplicateSelected()}
              disabled={!sceneEditor.selectedShape}
            >
              Duplicate selected shape
            </button>
            <button
              type="button"
              onClick={() => sceneEditor.deleteSelected()}
              disabled={!sceneEditor.selectedShape}
            >
              Delete selected shape
            </button>
          </div>

          <div role="group" aria-label="History" className="editor-tool-group">
            <button
              type="button"
              onClick={() => sceneEditor.undo()}
              disabled={!sceneEditor.canUndo}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => sceneEditor.redo()}
              disabled={!sceneEditor.canRedo}
            >
              Redo
            </button>
          </div>

          <h4>Shapes</h4>
          {sceneEditor.shapes.length === 0 ? (
            <p>No shapes yet.</p>
          ) : (
            <ul aria-label="Shape list" className="editor-shape-list">
              {sceneEditor.shapes.map((shape) => (
                <li key={shape.id}>
                  <button
                    type="button"
                    aria-pressed={shape.id === sceneEditor.selectedShapeId}
                    onClick={() => sceneEditor.selectShape(shape.id)}
                  >
                    {shapeLabel(shape)}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <SceneOutlinePanel sceneEditor={sceneEditor} />
        </section>

        <section
          role="region"
          aria-label="Preview"
          data-panel="preview"
          id="editor-panel-preview"
          className="editor-panel"
          hidden={panelHidden('preview')}
        >
          <h3>Preview</h3>
          <p>Scene rendering is added in a later task.</p>
          <p>{shapeCount} shape(s) in the working copy.</p>
          <div
            ref={canvasRef}
            data-testid="scene-canvas"
            aria-label="Scene canvas"
            className="editor-scene-canvas"
            style={{
              position: 'relative',
              width: canvasWidth,
              height: canvasHeight,
              maxWidth: '100%',
            }}
            onClick={handleCanvasClick}
          >
            {sceneEditor.shapes.map((shape, index) => (
              <div
                key={shape.id}
                data-testid={`scene-shape-${shape.id}`}
                data-shape-type={shape.type}
                aria-hidden="true"
                className="editor-scene-shape"
                style={{ position: 'absolute', zIndex: index }}
              >
                {shape.id === sceneEditor.selectedShapeId ? shapeSummary(shape) : null}
              </div>
            ))}
          </div>
        </section>

        <section
          role="region"
          aria-label="Inspector"
          data-panel="inspector"
          id="editor-panel-inspector"
          className="editor-panel"
          hidden={panelHidden('inspector')}
        >
          <h3>Inspector</h3>
          <p>Property editing is added in a later task.</p>
        </section>
      </div>
    </div>
  );
}

export default EditorWorkspace;
