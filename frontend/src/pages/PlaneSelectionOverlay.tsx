/**
 * Issue #782: photo-editor-style selection chrome for a drawing plane, drawn over the 3D stage.
 *
 *  1. On-canvas handles: a move handle (also the body), a rotate handle, corner handles that scale
 *     PROPORTIONALLY (Shift makes a corner stretch instead) and edge handles that stretch one axis.
 *  2. A small floating toolbar anchored to the selection with the common actions and one "More" overflow;
 *     on narrow (phone) stages it docks to the bottom of the stage with 44px targets.
 *  3. A precise-values panel opened ON DEMAND from the toolbar — never shown by default.
 *  4. Nothing here is a modal: it never blocks the canvas, and Escape dismisses it all.
 *
 * Gestures apply a live (transient) edit through `onGestureChange` and are folded into one undo step by
 * the owner (`onGestureStart`/`onGestureEnd`); discrete edits (toolbar, keyboard, precise values) go
 * through `onCommit`, one undo step each.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';

import {
  flipPlane,
  movePlaneByScreenDelta,
  projectPlane,
  resizePlane,
  rotatePlaneAboutView,
  scalePlaneUniform,
  screenAxes,
  setPlanePreset,
  stretchPlane,
  withTransform,
  type Point,
} from './planeTransform';
import type { Group3D, Object3D } from './scene3dTypes';

export type PlaneSelectionOverlayProps = {
  object: Object3D;
  group?: Group3D | null;
  camera: THREE.PerspectiveCamera | null;
  width: number;
  height: number;
  onGestureStart: () => void;
  onGestureChange: (next: Object3D) => void;
  onGestureEnd: () => void;
  onCommit: (next: Object3D) => void;
  onEditDrawing: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDeselect: () => void;
};

type HandleKind =
  | { type: 'move' }
  | { type: 'rotate' }
  | { type: 'corner'; index: 0 | 1 | 2 | 3 }
  | { type: 'edge'; index: 0 | 1 | 2 | 3 };

const CORNER_NAMES = ['top left', 'top right', 'bottom right', 'bottom left'] as const;
const EDGE_NAMES = ['top', 'right', 'bottom', 'left'] as const;
const DEFAULT_SPIN = { kind: 'rotate', axis: 'y', speed: 45 } as const;
const NARROW_STAGE_PX = 480;
const NUDGE_PX = 12;
const TOOLBAR_HEIGHT = 48;
const TOOLBAR_MIN_TOP = 64;
const IDENTITY_TRANSFORM = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

type Drag = {
  kind: HandleKind;
  start: Point;
  base: Object3D;
  center: Point;
  startDistance: number;
  startAngle: number;
  axes: { u: Point; v: Point };
  startOffset: Point;
  camera: THREE.PerspectiveCamera;
};

export default function PlaneSelectionOverlay(props: PlaneSelectionOverlayProps) {
  const {
    object,
    group,
    camera,
    width,
    height,
    onGestureStart,
    onGestureChange,
    onGestureEnd,
    onCommit,
    onEditDrawing,
    onDuplicate,
    onDelete,
    onDeselect,
  } = props;
  const [preciseOpen, setPreciseOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const toolbarId = useId();

  const projected = useMemo(
    () =>
      camera && width > 0 && height > 0
        ? projectPlane(object, group, camera, { width, height })
        : null,
    [object, group, camera, width, height],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // Escape that dismisses the stage's piece-controls menu must not also drop the selection.
      if (document.querySelector('.piece-stage-command-overlay:not([hidden])')) return;
      if (moreOpen) {
        setMoreOpen(false);
        return;
      }
      if (preciseOpen) {
        setPreciseOpen(false);
        return;
      }
      onDeselect();
    }
    // Capture phase: runs before the piece-controls menu's own Escape handler closes that menu.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [moreOpen, preciseOpen, onDeselect]);

  if (!projected || !projected.visible || !camera) return null;
  const stage = { width, height };
  const narrow = width <= NARROW_STAGE_PX;

  const stagePoint = (event: { clientX: number; clientY: number }): Point => {
    const rect = rootRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  function beginDrag(kind: HandleKind, event: React.PointerEvent) {
    if (!camera || !projected) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    const start = stagePoint(event);
    const center = projected.center;
    dragRef.current = {
      kind,
      start,
      base: object,
      center,
      startDistance: Math.max(8, Math.hypot(start.x - center.x, start.y - center.y)),
      startAngle: Math.atan2(start.y - center.y, start.x - center.x),
      axes: screenAxes(projected),
      startOffset: { x: start.x - center.x, y: start.y - center.y },
      camera,
    };
    setMoreOpen(false);
    onGestureStart();
    setDragging(true);
    if (kind.type !== 'move' && kind.type !== 'rotate') setResizing(true);
  }

  function moveDrag(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = stagePoint(event);
    const { kind, base } = drag;
    let next: Object3D = base;
    if (kind.type === 'move') {
      next = movePlaneByScreenDelta(
        base,
        { x: point.x - drag.start.x, y: point.y - drag.start.y },
        drag.camera,
        stage,
      );
    } else if (kind.type === 'rotate') {
      const angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x) - drag.startAngle;
      next = rotatePlaneAboutView(base, angle, drag.camera);
    } else if (kind.type === 'corner') {
      if (event.shiftKey) {
        const off = { x: point.x - drag.center.x, y: point.y - drag.center.y };
        const fu =
          (off.x * drag.axes.u.x + off.y * drag.axes.u.y) /
          (drag.startOffset.x * drag.axes.u.x + drag.startOffset.y * drag.axes.u.y || 1);
        const fv =
          (off.x * drag.axes.v.x + off.y * drag.axes.v.y) /
          (drag.startOffset.x * drag.axes.v.x + drag.startOffset.y * drag.axes.v.y || 1);
        next = resizePlane(
          base,
          { width: (base.width ?? 1) * Math.abs(fu), height: (base.height ?? 1) * Math.abs(fv) },
          false,
        );
      } else {
        const distance = Math.hypot(point.x - drag.center.x, point.y - drag.center.y);
        next = scalePlaneUniform(base, distance / drag.startDistance);
      }
    } else if (kind.type === 'edge') {
      const horizontal = kind.index === 1 || kind.index === 3;
      const axis = horizontal ? drag.axes.u : drag.axes.v;
      const off = (point.x - drag.center.x) * axis.x + (point.y - drag.center.y) * axis.y;
      const startAlong = drag.startOffset.x * axis.x + drag.startOffset.y * axis.y || 1;
      next = stretchPlane(base, horizontal ? 'width' : 'height', Math.abs(off / startAlong));
    }
    onGestureChange(next);
  }

  function endDrag(event: React.PointerEvent) {
    if (!dragRef.current) return;
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setResizing(false);
    setDragging(false);
    onGestureEnd();
  }

  const handleProps = (kind: HandleKind) => ({
    onPointerDown: (event: React.PointerEvent) => beginDrag(kind, event),
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  });

  function keyNudge(kind: HandleKind, event: React.KeyboardEvent) {
    if (!camera) return;
    const step = event.shiftKey ? NUDGE_PX * 3 : NUDGE_PX;
    const arrows: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    if (kind.type === 'move' && arrows[event.key]) {
      event.preventDefault();
      onCommit(movePlaneByScreenDelta(object, arrows[event.key]!, camera, stage));
    } else if (
      kind.type === 'rotate' &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      event.preventDefault();
      onCommit(
        rotatePlaneAboutView(
          object,
          ((event.key === 'ArrowRight' ? 1 : -1) * Math.PI * (event.shiftKey ? 15 : 5)) / 180,
          camera,
        ),
      );
    } else if (
      kind.type === 'corner' &&
      (event.key === '+' || event.key === '=' || event.key === '-')
    ) {
      event.preventDefault();
      onCommit(scalePlaneUniform(object, event.key === '-' ? 0.95 : 1.05));
    } else if (
      kind.type === 'edge' &&
      (event.key === '+' || event.key === '=' || event.key === '-')
    ) {
      event.preventDefault();
      const horizontal = kind.index === 1 || kind.index === 3;
      onCommit(
        stretchPlane(object, horizontal ? 'width' : 'height', event.key === '-' ? 0.95 : 1.05),
      );
    }
  }

  const label = object.name ?? 'Drawing plane';
  const animated = Boolean(object.animation);
  const toolbarStyle = narrow
    ? undefined
    : {
        left: Math.min(Math.max(projected.center.x, 150), Math.max(150, width - 150)),
        // Never under the shared stage toolbar band along the top of the stage.
        top: Math.max(
          TOOLBAR_MIN_TOP,
          Math.min(...projected.corners.map((c) => c.y), projected.rotate.y) - TOOLBAR_HEIGHT - 14,
        ),
      };

  return (
    <div
      ref={rootRef}
      className="plane-selection-overlay"
      data-testid="plane-selection-overlay"
      data-resizing={resizing ? 'true' : undefined}
    >
      <svg className="plane-selection-outline" width={width} height={height} aria-hidden="true">
        <polygon points={projected.corners.map((c) => `${c.x},${c.y}`).join(' ')} />
        <line
          x1={projected.edges[0].x}
          y1={projected.edges[0].y}
          x2={projected.rotate.x}
          y2={projected.rotate.y}
        />
      </svg>
      <button
        type="button"
        className="plane-handle plane-handle--move"
        aria-label={`Move ${label}. Drag, or use the arrow keys.`}
        style={{ left: projected.center.x, top: projected.center.y }}
        data-testid="plane-handle-move"
        onKeyDown={(event) => keyNudge({ type: 'move' }, event)}
        {...handleProps({ type: 'move' })}
      >
        <span aria-hidden="true">✥</span>
      </button>
      <button
        type="button"
        className="plane-handle plane-handle--rotate"
        aria-label={`Rotate ${label}. Drag, or use the left and right arrow keys.`}
        style={{ left: projected.rotate.x, top: projected.rotate.y }}
        data-testid="plane-handle-rotate"
        onKeyDown={(event) => keyNudge({ type: 'rotate' }, event)}
        {...handleProps({ type: 'rotate' })}
      >
        <span aria-hidden="true">⟳</span>
      </button>
      {projected.corners.map((corner, index) => (
        <button
          key={`corner-${index}`}
          type="button"
          className="plane-handle plane-handle--corner"
          aria-label={`Scale ${label} proportionally from the ${CORNER_NAMES[index]} corner. Hold Shift to stretch, or press plus and minus.`}
          style={{ left: corner.x, top: corner.y }}
          data-testid={`plane-handle-corner-${index}`}
          onKeyDown={(event) => keyNudge({ type: 'corner', index: index as 0 | 1 | 2 | 3 }, event)}
          {...handleProps({ type: 'corner', index: index as 0 | 1 | 2 | 3 })}
        />
      ))}
      {projected.edges.map((edge, index) => (
        <button
          key={`edge-${index}`}
          type="button"
          className="plane-handle plane-handle--edge"
          aria-label={`Stretch ${label} from the ${EDGE_NAMES[index]} edge (changes proportions). Press plus and minus.`}
          style={{ left: edge.x, top: edge.y }}
          data-testid={`plane-handle-edge-${index}`}
          onKeyDown={(event) => keyNudge({ type: 'edge', index: index as 0 | 1 | 2 | 3 }, event)}
          {...handleProps({ type: 'edge', index: index as 0 | 1 | 2 | 3 })}
        />
      ))}
      {resizing && (
        <p className="plane-resize-readout" role="status" data-testid="plane-resize-readout">
          {(object.width ?? 1).toFixed(2)} × {(object.height ?? 1).toFixed(2)}
          <span> · Shift stretches</span>
        </p>
      )}
      <div
        id={toolbarId}
        role="toolbar"
        aria-label={`${label} actions`}
        className="plane-selection-toolbar"
        data-dock={narrow ? 'bottom' : 'float'}
        data-dragging={dragging ? 'true' : undefined}
        data-testid="plane-selection-toolbar"
        style={toolbarStyle}
      >
        <button
          type="button"
          onClick={() => onCommit(setPlanePreset(object, 'horizontal'))}
          aria-label="Rotate horizontal (lay flat)"
        >
          <span aria-hidden="true">▭</span>
          <span className="plane-toolbar-label">Horizontal</span>
        </button>
        <button
          type="button"
          onClick={() => onCommit(setPlanePreset(object, 'vertical'))}
          aria-label="Rotate vertical (stand upright)"
        >
          <span aria-hidden="true">▯</span>
          <span className="plane-toolbar-label">Vertical</span>
        </button>
        <button
          type="button"
          onClick={() => onCommit(flipPlane(object))}
          aria-label="Flip left to right"
        >
          <span aria-hidden="true">⇋</span>
          <span className="plane-toolbar-label">Flip</span>
        </button>
        <button
          type="button"
          aria-pressed={animated}
          onClick={() =>
            onCommit(
              animated
                ? { ...object, animation: undefined }
                : { ...object, animation: { ...DEFAULT_SPIN } },
            )
          }
          aria-label={animated ? 'Stop animation' : 'Animate (spin)'}
        >
          <span aria-hidden="true">◌</span>
          <span className="plane-toolbar-label">Animate</span>
        </button>
        <button type="button" onClick={onEditDrawing} aria-label="Edit drawing">
          <span aria-hidden="true">✎</span>
          <span className="plane-toolbar-label">Draw</span>
        </button>
        <button
          type="button"
          aria-pressed={preciseOpen}
          aria-expanded={preciseOpen}
          onClick={() => {
            setPreciseOpen((open) => !open);
            setMoreOpen(false);
          }}
          aria-label="Precise values"
        >
          <span aria-hidden="true">#</span>
          <span className="plane-toolbar-label">Precise</span>
        </button>
        <span className="plane-more">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            aria-label="More actions"
          >
            <span aria-hidden="true">⋯</span>
            <span className="plane-toolbar-label">More</span>
          </button>
          {moreOpen && (
            <div role="menu" aria-label="More actions" className="plane-more-menu">
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onDuplicate();
                }}
              >
                Duplicate
              </button>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onCommit(
                    withTransform(object, {
                      ...IDENTITY_TRANSFORM,
                      opacity: object.transform.opacity,
                    }),
                  );
                }}
              >
                Reset transform
              </button>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onDelete();
                }}
              >
                Delete
              </button>
            </div>
          )}
        </span>
      </div>
      {preciseOpen && (
        <PrecisePanel
          object={object}
          onCommit={onCommit}
          onClose={() => setPreciseOpen(false)}
          narrow={narrow}
        />
      )}
    </div>
  );
}

function PrecisePanel({
  object,
  onCommit,
  onClose,
  narrow,
}: {
  object: Object3D;
  onCommit: (next: Object3D) => void;
  onClose: () => void;
  narrow: boolean;
}) {
  const [keepProportions, setKeepProportions] = useState(true);
  const t = object.transform;
  const fields: Array<{
    id: string;
    label: string;
    value: number;
    apply: (o: Object3D, v: number) => Object3D;
    step: number;
  }> = [
    {
      id: 'px',
      label: 'Position X',
      value: t.position.x,
      step: 0.1,
      apply: (o, v) => withTransform(o, { position: { ...o.transform.position, x: v } }),
    },
    {
      id: 'py',
      label: 'Position Y',
      value: t.position.y,
      step: 0.1,
      apply: (o, v) => withTransform(o, { position: { ...o.transform.position, y: v } }),
    },
    {
      id: 'pz',
      label: 'Position Z',
      value: t.position.z,
      step: 0.1,
      apply: (o, v) => withTransform(o, { position: { ...o.transform.position, z: v } }),
    },
    {
      id: 'rx',
      label: 'Rotation X°',
      value: t.rotation.x,
      step: 1,
      apply: (o, v) => withTransform(o, { rotation: { ...o.transform.rotation, x: v } }),
    },
    {
      id: 'ry',
      label: 'Rotation Y°',
      value: t.rotation.y,
      step: 1,
      apply: (o, v) => withTransform(o, { rotation: { ...o.transform.rotation, y: v } }),
    },
    {
      id: 'rz',
      label: 'Rotation Z°',
      value: t.rotation.z,
      step: 1,
      apply: (o, v) => withTransform(o, { rotation: { ...o.transform.rotation, z: v } }),
    },
  ];
  return (
    <section
      role="region"
      aria-label="Precise transform values"
      className="plane-precise-panel"
      data-dock={narrow ? 'bottom' : 'side'}
      data-testid="plane-precise-panel"
    >
      <header>
        <strong>Precise values</strong>
        <button type="button" onClick={onClose} aria-label="Close precise values">
          ×
        </button>
      </header>
      <div className="plane-precise-grid">
        {fields.map((field) => (
          <NumberField key={field.id} {...field} object={object} onCommit={onCommit} />
        ))}
        <NumberField
          id="pw"
          label="Width"
          value={object.width ?? 1}
          step={0.1}
          object={object}
          onCommit={onCommit}
          apply={(o, v) => resizePlane(o, { width: v }, keepProportions)}
        />
        <NumberField
          id="ph"
          label="Height"
          value={object.height ?? 1}
          step={0.1}
          object={object}
          onCommit={onCommit}
          apply={(o, v) => resizePlane(o, { height: v }, keepProportions)}
        />
      </div>
      <label className="plane-precise-lock">
        <input
          type="checkbox"
          checked={keepProportions}
          onChange={(event) => setKeepProportions(event.target.checked)}
        />
        Keep proportions
      </label>
    </section>
  );
}

function NumberField({
  id,
  label,
  value,
  step,
  object,
  apply,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  step: number;
  object: Object3D;
  apply: (object: Object3D, value: number) => Object3D;
  onCommit: (next: Object3D) => void;
}) {
  const inputId = useId();
  const shown = String(Math.round(value * 1000) / 1000);
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    if (!Number.isFinite(parsed) || draft.trim() === '') return;
    onCommit(apply(object, parsed));
  }
  return (
    <label htmlFor={inputId} className="plane-precise-field" data-field={id}>
      <span>{label}</span>
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        step={step}
        value={draft ?? shown}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setDraft(null);
        }}
      />
    </label>
  );
}
