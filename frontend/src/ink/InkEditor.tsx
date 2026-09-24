/**
 * Issues #775/#781: the shared ink editor. A frozen drawing surface (optionally over a snapshot of the
 * piece being annotated) with pen, pencil, eraser and select tools, an independent Undo/Redo history, and
 * Confirm/Cancel. It edits `DrawingShape[]` in the drawing's own pixel space and knows nothing about
 * scenes, so the structured 2D editor and the 3D drawing-plane editor both mount it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DrawingShape } from '../pages/scene3dTypes';
import { paintDrawing } from '../render/drawingRaster';
import type { InkPoint } from './inkGeometry';
import { shapeBounds } from './inkGeometry';
import {
  addStroke,
  buildStroke,
  canRedo,
  canUndo,
  clearAll,
  createInkState,
  deleteSelected,
  eraseAt,
  inkDirty,
  inkShapes,
  moveSelected,
  nextInkId,
  redo,
  selectAt,
  undo,
  buildDraggedShape,
  isShapeTool,
  type InkState,
  type InkTool,
} from './inkModel';

export type InkEditorProps = {
  width: number;
  height: number;
  initialShapes: DrawingShape[];
  /** Colour painted behind the strokes; omit for a transparent layer. */
  background?: string | null;
  /** A picture of the frozen piece drawn behind the ink so the author can annotate in place. */
  snapshotUrl?: string | null;
  strokeIdPrefix?: string;
  /** The tool that is active when the editor opens (defaults to the pen). */
  initialTool?: InkTool;
  /** Per-stroke point cap and per-layer stroke cap, from the owning document's limits. */
  maxPointsPerStroke?: number;
  maxStrokes?: number;
  onConfirm: (shapes: DrawingShape[]) => void;
  onCancel: () => void;
};

const TOOLS: Array<{ id: InkTool; label: string }> = [
  { id: 'pen', label: 'Pen' },
  { id: 'pencil', label: 'Pencil' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'line', label: 'Line' },
  { id: 'eraser', label: 'Eraser' },
  { id: 'select', label: 'Select' },
];

export function InkEditor({
  width,
  height,
  initialShapes,
  background = null,
  snapshotUrl = null,
  strokeIdPrefix = 'ink',
  initialTool = 'pen',
  maxPointsPerStroke,
  maxStrokes,
  onConfirm,
  onCancel,
}: InkEditorProps) {
  const [state, setState] = useState<InkState>(() => createInkState(initialShapes));
  const [tool, setTool] = useState<InkTool>(initialTool);
  const [color, setColor] = useState('#1d4ed8');
  const [size, setSize] = useState(6);
  const [filled, setFilled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [live, setLive] = useState<InkPoint[] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ last: InkPoint; moved: boolean } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const shapes = inkShapes(state);
  const liveShape = useMemo(() => {
    if (!live || live.length === 0) return null;
    if (tool === 'pen' || tool === 'pencil') {
      return buildStroke(
        '__live__',
        tool,
        live.length === 1 ? [live[0]!, live[0]!] : live,
        { color, size },
        maxPointsPerStroke,
      );
    }
    if (isShapeTool(tool)) {
      return buildDraggedShape(
        '__live__',
        tool,
        live[0]!,
        live[live.length - 1]!,
        { color, size },
        filled,
      );
    }
    return null;
  }, [live, tool, color, size, filled, maxPointsPerStroke]);

  // Repaint whenever the strokes, the in-progress stroke, or the selection change.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const all = liveShape ? [...shapes, liveShape] : shapes;
    paintDrawing(ctx, { width, height, background, shapes: all });
    const selected = shapes.find((s) => s.id === state.selectedId);
    if (selected) {
      const box = shapeBounds(selected);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x - 3, box.y - 3, box.width + 6, box.height + 6);
      ctx.restore();
    }
  }, [shapes, liveShape, state.selectedId, width, height, background]);

  const toDrawingPoint = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): InkPoint => {
      const rect = event.currentTarget.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * width,
        y: ((event.clientY - rect.top) / rect.height) * height,
      };
    },
    [width, height],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = toDrawingPoint(event);
    setMessage(null);
    dragRef.current = { last: point, moved: false };
    if (tool === 'pen' || tool === 'pencil' || isShapeTool(tool)) setLive([point]);
    else if (tool === 'eraser') setState((s) => eraseAt(s, [point], size + 2));
    else setState((s) => selectAt(s, point, 6));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toDrawingPoint(event);
    if (tool === 'pen' || tool === 'pencil') {
      setLive((points) => (points ? [...points, point] : [point]));
    } else if (isShapeTool(tool)) {
      setLive((points) => (points ? [points[0]!, point] : [point]));
    } else if (tool === 'eraser') {
      setState((s) => eraseAt(s, [point], size + 2));
    } else if (tool === 'select' && stateRef.current.selectedId) {
      const dx = point.x - drag.last.x;
      const dy = point.y - drag.last.y;
      // Movement within one gesture collapses into a single undo step.
      if (dx !== 0 || dy !== 0) {
        const merge = drag.moved;
        drag.moved = true;
        setState((s) => moveSelected(s, dx, dy, merge));
      }
    }
    drag.last = point;
  };

  const finish = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if ((tool === 'pen' || tool === 'pencil') && live && live.length > 0) {
      const stroke = buildStroke(
        nextInkId(shapes, strokeIdPrefix),
        tool,
        live.length === 1 ? [live[0]!, { x: live[0]!.x + 0.1, y: live[0]!.y }] : live,
        { color, size },
        maxPointsPerStroke,
      );
      const result = addStroke(state, stroke, maxStrokes);
      setState(result.state);
      setMessage(result.error ?? null);
    } else if (isShapeTool(tool) && live && live.length > 1) {
      const shape = buildDraggedShape(
        nextInkId(shapes, strokeIdPrefix),
        tool,
        live[0]!,
        live[live.length - 1]!,
        { color, size },
        filled,
      );
      const result = addStroke(state, shape, maxStrokes);
      setState(result.state);
      setMessage(result.error ?? null);
    }
    setLive(null);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      setState((s) => (event.shiftKey ? redo(s) : undo(s)));
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (stateRef.current.selectedId) {
        event.preventDefault();
        setState((s) => deleteSelected(s));
      }
    }
  };

  return (
    <div
      className="ink-editor"
      data-testid="ink-editor"
      role="group"
      aria-label="Ink editor. The piece is frozen while you draw."
      onKeyDown={onKeyDown}
    >
      <div className="ink-editor-bar" data-testid="ink-editor-bar">
        <span className="ink-editor-frozen" data-testid="ink-frozen-indicator">
          Frozen — drawing
        </span>
        <div role="radiogroup" aria-label="Ink tool" className="ink-editor-tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tool === t.id}
              data-testid={`ink-tool-${t.id}`}
              className={tool === t.id ? 'ink-tool is-active' : 'ink-tool'}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="ink-editor-field">
          Colour
          <input
            type="color"
            value={color}
            data-testid="ink-color"
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        {isShapeTool(tool) && tool !== 'line' && (
          <label className="ink-editor-field">
            <input
              type="checkbox"
              checked={filled}
              data-testid="ink-fill"
              onChange={(e) => setFilled(e.target.checked)}
            />
            Fill
          </label>
        )}
        <label className="ink-editor-field">
          Size
          <input
            type="range"
            min={1}
            max={40}
            value={size}
            data-testid="ink-size"
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          data-testid="ink-undo"
          disabled={!canUndo(state)}
          onClick={() => setState(undo)}
        >
          Undo
        </button>
        <button
          type="button"
          data-testid="ink-redo"
          disabled={!canRedo(state)}
          onClick={() => setState(redo)}
        >
          Redo
        </button>
        <button
          type="button"
          data-testid="ink-delete"
          disabled={!state.selectedId}
          onClick={() => setState(deleteSelected)}
        >
          Delete
        </button>
        <button
          type="button"
          data-testid="ink-clear"
          disabled={shapes.length === 0}
          onClick={() => setState(clearAll)}
        >
          Clear
        </button>
        <span className="ink-editor-spacer" />
        <button type="button" data-testid="ink-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="ink-confirm"
          data-testid="ink-confirm"
          onClick={() => onConfirm(shapes)}
        >
          {inkDirty(state) ? 'Confirm' : 'Done'}
        </button>
      </div>
      {message && (
        <p role="alert" className="ink-editor-message" data-testid="ink-message">
          {message}
        </p>
      )}
      <div className="ink-editor-surface" style={{ aspectRatio: `${width} / ${height}` }}>
        {snapshotUrl && (
          <img src={snapshotUrl} alt="" className="ink-editor-snapshot" draggable={false} />
        )}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="ink-editor-canvas"
          data-testid="ink-canvas"
          aria-label="Drawing surface"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onPointerLeave={finish}
        />
      </div>
    </div>
  );
}
