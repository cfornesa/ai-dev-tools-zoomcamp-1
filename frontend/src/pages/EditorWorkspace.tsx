import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link, useParams } from 'react-router-dom';

import EditorPanelSwitcher, { type EditorPanelName } from '../components/EditorPanelSwitcher';
import { createP5ScenePreview, type P5ScenePreview } from '../render/p5Adapter';
import {
  applyShapeDrag,
  clientToCanvasPoint,
  getShapeHandles,
  hitTestTopmostShapeAt,
  shapeLabel,
  type HandleKind,
  type Point,
  type Shape,
  type ShapeType,
} from './sceneShapes';
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
 *
 * Task 26 adds pointer-based move/resize/rotate handles for the single
 * selected shape, as a DOM overlay on top of the p5 canvas (never inside
 * `p5Adapter.ts` — see that file's own comment on why). A drag is tracked
 * in `dragRef` (not React state, since it doesn't need re-renders itself —
 * the live shape mutation it drives, via `sceneEditor.updateSelectedTransform`,
 * already re-renders through `workingCopy`) and driven by `window`-level
 * pointermove/pointerup/keydown listeners, registered once per gesture in
 * `beginDrag`, so the drag keeps tracking the pointer even outside the
 * canvas element's own bounds and Escape can cancel it from anywhere.
 */
function EditorWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { loadState, project, workingCopy, setWorkingCopy, retry } = useEditorWorkspaceState(id);
  const isNarrow = useIsNarrowViewport();
  const [activePanel, setActivePanel] = useState<EditorPanelName>('preview');
  const sceneEditor = useSceneEditor(workingCopy, setWorkingCopy);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewMountRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<P5ScenePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Task 26: "latest value" refs so the window-level drag listeners below
  // (created once, lazily, and reused for the lifetime of the component —
  // see `dragHandlers`) always act against the current scene editor and
  // canvas size, not whichever render happened to be active when a given
  // drag gesture began.
  const sceneEditorRef = useRef(sceneEditor);
  sceneEditorRef.current = sceneEditor;
  const canvasSizeRef = useRef({ width: 800, height: 600 });
  // In-progress drag gesture, or null when nothing is being dragged. Not
  // React state: updating it never needs to trigger a re-render itself —
  // the live shape mutation each pointermove performs (via
  // `sceneEditor.updateSelectedTransform`) already re-renders the
  // component through `workingCopy` changing.
  const dragRef = useRef<{ kind: HandleKind; startShape: Shape; startPointer: Point } | null>(null);
  // Lazily built once (see the `if` below) and reused for every gesture,
  // so `window.addEventListener`/`removeEventListener` always agree on the
  // exact same function identity — including the unmount cleanup effect
  // further down, which must be able to remove listeners left behind by a
  // gesture still in progress when the workspace unmounts.
  const dragHandlers = useRef<{
    onMove: (event: PointerEvent) => void;
    onUp: (event: PointerEvent) => void;
    onKey: (event: KeyboardEvent) => void;
  } | null>(null);
  if (!dragHandlers.current) {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { width, height } = canvasSizeRef.current;
      const pointer = clientToCanvasPoint(rect, event.clientX, event.clientY, width, height);
      const updated = applyShapeDrag(drag.kind, drag.startShape, drag.startPointer, pointer);
      sceneEditorRef.current.updateSelectedTransform(updated);
    };
    const onUp = (event: PointerEvent) => {
      if (!dragRef.current) return;
      event.preventDefault();
      stopDragListening();
      dragRef.current = null;
      sceneEditorRef.current.commitTransform();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragRef.current) return;
      event.preventDefault();
      stopDragListening();
      dragRef.current = null;
      sceneEditorRef.current.cancelTransform();
    };
    function stopDragListening() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    }
    dragHandlers.current = { onMove, onUp, onKey };
  }

  // Removes any drag listeners still attached if the workspace unmounts
  // mid-gesture (e.g. navigating away while dragging).
  useEffect(() => {
    return () => {
      const handlers = dragHandlers.current;
      if (!handlers) return;
      window.removeEventListener('pointermove', handlers.onMove);
      window.removeEventListener('pointerup', handlers.onUp);
      window.removeEventListener('keydown', handlers.onKey);
    };
  }, []);

  // Task 25: mounts a p5.js instance (instance mode, never global) into a
  // dedicated child div that React never re-renders into — see the div's
  // own comment below for why. Created once per workspace mount, torn
  // down on unmount.
  useEffect(() => {
    if (!previewMountRef.current) return;
    const preview = createP5ScenePreview(previewMountRef.current);
    previewRef.current = preview;
    return () => {
      preview.destroy();
      previewRef.current = null;
    };
  }, []);

  // Re-renders the p5 preview whenever the working copy changes. A scene
  // that fails the adapter's validation (see p5Adapter.ts/sceneDrawPlan.ts)
  // throws before any draw call rather than drawing something wrong or
  // stale; that's surfaced here instead of crashing the workspace.
  useEffect(() => {
    if (!previewRef.current || !workingCopy) return;
    try {
      previewRef.current.render(workingCopy);
      setPreviewError(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not render this scene.');
    }
  }, [workingCopy]);

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
  canvasSizeRef.current = { width: canvasWidth, height: canvasHeight };

  function panelHidden(panel: EditorPanelName): boolean {
    return isNarrow && activePanel !== panel;
  }

  // Shared by every pointer-to-scene conversion below (click-to-select,
  // drag start, and handle drag start) so they all agree on the same
  // canvas-local point for a given client position — including when the
  // canvas element is CSS-scaled smaller than its logical `canvasWidth`/
  // `canvasHeight` (see `clientToCanvasPoint`'s own comment).
  function canvasPointFromClient(clientX: number, clientY: number): Point | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return clientToCanvasPoint(rect, clientX, clientY, canvasWidth, canvasHeight);
  }

  function handleCanvasClick(event: ReactMouseEvent<HTMLDivElement>) {
    const pointer = canvasPointFromClient(event.clientX, event.clientY);
    if (!pointer) return;
    const hit = hitTestTopmostShapeAt(sceneEditor.shapes, pointer.x, pointer.y);
    sceneEditor.selectShape(hit ? hit.id : null);
  }

  // Starts a Task 26 move/resize/rotate gesture: snapshots the pre-gesture
  // scene and registers the window-level listeners `dragHandlers` built
  // once above.
  function beginDrag(kind: HandleKind, shape: Shape, pointer: Point) {
    const handlers = dragHandlers.current;
    if (!handlers) return;
    dragRef.current = { kind, startShape: shape, startPointer: pointer };
    sceneEditor.beginTransform();
    window.addEventListener('pointermove', handlers.onMove);
    window.addEventListener('pointerup', handlers.onUp);
    window.addEventListener('keydown', handlers.onKey);
  }

  // Dragging the shape body itself is the "move" gesture (per the
  // acceptance criteria: "dragging the shape body or its move handle").
  // Starting on a shape other than the current selection selects it first,
  // matching `handleCanvasClick`'s own click-to-select, then manipulates
  // it in the same gesture.
  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const pointer = canvasPointFromClient(event.clientX, event.clientY);
    if (!pointer) return;
    const hit = hitTestTopmostShapeAt(sceneEditor.shapes, pointer.x, pointer.y);
    if (!hit) return; // no shape body under the pointer: nothing to drag
    if (hit.id !== sceneEditor.selectedShapeId) {
      sceneEditor.selectShape(hit.id);
    }
    beginDrag('move', hit, pointer);
  }

  // A resize/rotate handle is only ever rendered for the current single
  // selection (see the render below), so there's no separate hit-test or
  // selection step here — just start manipulating the already-selected
  // shape. `stopPropagation` keeps this from also bubbling into
  // `handleCanvasPointerDown`, which would otherwise hit-test the same
  // point against shape bodies underneath the handle.
  function handleHandlePointerDown(kind: HandleKind) {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const shape = sceneEditor.selectedShape;
      if (!shape) return;
      const pointer = canvasPointFromClient(event.clientX, event.clientY);
      if (!pointer) return;
      beginDrag(kind, shape, pointer);
    };
  }

  function handleStyle(point: Point): CSSProperties {
    return {
      position: 'absolute',
      left: `${(point.x / canvasWidth) * 100}%`,
      top: `${(point.y / canvasHeight) * 100}%`,
      width: 12,
      height: 12,
      marginLeft: -6,
      marginTop: -6,
      touchAction: 'none',
    };
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
          <p>{shapeCount} shape(s) in the working copy.</p>
          {previewError && (
            <p role="alert" aria-live="assertive">
              Couldn't render the preview: {previewError}
            </p>
          )}
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
            onPointerDown={handleCanvasPointerDown}
          >
            {/* Task 25: the p5.js preview mounts its <canvas> into this div.
                React is never given any children to reconcile here (no JSX
                children below), so it never touches — or fights over —
                nodes p5 appends directly to the real DOM. */}
            <div
              ref={previewMountRef}
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, zIndex: -1 }}
            />
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
            {/* Task 26: move/resize/rotate handles for the single selected
                shape only — a group selection (selectedShape is null then)
                or no selection at all shows none. Re-derived fresh from
                the current selection/scene on every render, so a selection
                change, a delete, or an undo/redo that changes the
                selection automatically leaves no stale handle behind. */}
            {sceneEditor.selectedShape &&
              (() => {
                const handles = getShapeHandles(sceneEditor.selectedShape);
                return (
                  <>
                    <div
                      data-testid="shape-handle-move"
                      aria-hidden="true"
                      className="editor-shape-handle editor-shape-handle-move"
                      style={handleStyle(handles.move)}
                      onPointerDown={handleHandlePointerDown('move')}
                    />
                    <div
                      data-testid="shape-handle-resize"
                      aria-hidden="true"
                      className="editor-shape-handle editor-shape-handle-resize"
                      style={handleStyle(handles.resize)}
                      onPointerDown={handleHandlePointerDown('resize')}
                    />
                    <div
                      data-testid="shape-handle-rotate"
                      aria-hidden="true"
                      className="editor-shape-handle editor-shape-handle-rotate"
                      style={handleStyle(handles.rotate)}
                      onPointerDown={handleHandlePointerDown('rotate')}
                    />
                  </>
                );
              })()}
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
