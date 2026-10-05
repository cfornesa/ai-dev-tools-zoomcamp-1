import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

import {
  visitorStrokeIntersects,
  type VisitorPoint,
  type VisitorStroke,
  type VisitorTool,
} from './visitorDrawing';
import {
  commitVisitorHistory,
  createVisitorHistory,
  redoVisitorHistory,
  undoVisitorHistory,
  type VisitorHistory,
} from './visitorDrawingHistory';

type Props = {
  library: string;
  stageRef: RefObject<HTMLDivElement | null>;
};

function contrastingVisitorColor(background: string): string {
  const match = background.match(/rgba?\(([^)]+)\)/);
  if (!match) return '#ffffff';
  const channels = match[1]
    .split(',')
    .slice(0, 3)
    .map((value) => Number(value.trim()));
  if (channels.some((value) => !Number.isFinite(value))) return '#ffffff';
  const luminance = channels.reduce((sum, value) => sum + value, 0) / 3;
  return luminance > 150 ? '#111111' : '#ffffff';
}

export function useVisitorDrawingOverlay({ library, stageRef }: Props) {
  const [visitorDrawOn, setVisitorDrawOn] = useState(false);
  const [visitorTool, setVisitorTool] = useState<VisitorTool>('pencil');
  const [visitorSize, setVisitorSize] = useState(4);
  const [visitorColor, setVisitorColor] = useState('#ffffff');
  const [visitorStrokes, setVisitorStrokes] = useState<VisitorStroke[]>([]);
  const [visitorHistory, setVisitorHistory] = useState<VisitorHistory<VisitorStroke>>(() =>
    createVisitorHistory(),
  );
  const [eraserPoint, setEraserPoint] = useState<VisitorPoint | null>(null);
  const visitorOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const visitorStrokesRef = useRef<VisitorStroke[]>([]);
  const visitorPointerIdRef = useRef<number | null>(null);
  const activeTouchPointerIdsRef = useRef(new Set<number>());
  const touchStrokeIndexRef = useRef<number | null>(null);
  visitorStrokesRef.current = visitorStrokes;

  function visitorStrokeWidth(stroke: VisitorStroke, scale: number) {
    return stroke.size * scale * (stroke.tool === 'brush' ? 1.75 : 1);
  }

  function drawVisitorStroke(
    context: CanvasRenderingContext2D,
    stroke: VisitorStroke,
    width: number,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    if (stroke.points.length === 0) return;
    const first = stroke.points[0];
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = width;
    context.lineCap = stroke.tool === 'brush' ? 'round' : 'butt';
    context.lineJoin = stroke.tool === 'brush' ? 'round' : 'miter';
    if (stroke.points.length === 1) {
      context.beginPath();
      if (stroke.tool === 'brush') {
        context.arc(first.x * canvasWidth, first.y * canvasHeight, width / 2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(
          first.x * canvasWidth - width / 2,
          first.y * canvasHeight - width / 2,
          width,
          width,
        );
      }
      return;
    }
    context.beginPath();
    context.moveTo(first.x * canvasWidth, first.y * canvasHeight);
    for (const point of stroke.points.slice(1)) {
      context.lineTo(point.x * canvasWidth, point.y * canvasHeight);
    }
    context.stroke();
  }

  const drawVisitorOverlay = useCallback(() => {
    const canvas = visitorOverlayRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of visitorStrokesRef.current) {
      drawVisitorStroke(
        context,
        stroke,
        visitorStrokeWidth(stroke, canvas.width / 320),
        canvas.width,
        canvas.height,
      );
    }
  }, []);

  const updateVisitorOverlaySize = useCallback(() => {
    const canvas = visitorOverlayRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const scale = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(stage.clientWidth * scale));
    const height = Math.max(1, Math.floor(stage.clientHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    drawVisitorOverlay();
  }, [drawVisitorOverlay, stageRef]);

  useEffect(() => {
    if (library !== 'c2js-interactive') return;
    const stage = stageRef.current;
    if (stage) setVisitorColor(contrastingVisitorColor(getComputedStyle(stage).backgroundColor));
    updateVisitorOverlaySize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateVisitorOverlaySize);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [library, stageRef, updateVisitorOverlaySize]);

  useEffect(() => drawVisitorOverlay(), [drawVisitorOverlay, visitorStrokes]);

  function visitorPoint(event: PointerEvent<HTMLCanvasElement>): VisitorPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function visitorEraseRadius(stroke?: VisitorStroke): number {
    const stageWidth = stageRef.current?.clientWidth || 320;
    const eraserRadius = visitorSize / (2 * stageWidth);
    if (!stroke) return eraserRadius;
    return eraserRadius + visitorStrokeWidth(stroke, stageWidth / 320) / (2 * stageWidth);
  }

  function commitVisitorStrokes(next: VisitorStroke[]) {
    setVisitorHistory((history) => commitVisitorHistory(history, next));
    visitorStrokesRef.current = next;
    setVisitorStrokes(next);
  }

  function applyVisitorHistory(nextHistory: VisitorHistory<VisitorStroke>) {
    setVisitorHistory(nextHistory);
    visitorStrokesRef.current = nextHistory.present;
    setVisitorStrokes(nextHistory.present);
  }

  function undoVisitorStrokes() {
    applyVisitorHistory(undoVisitorHistory(visitorHistory));
  }

  function redoVisitorStrokes() {
    applyVisitorHistory(redoVisitorHistory(visitorHistory));
  }

  function startVisitorStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!visitorDrawOn) return;
    if (event.pointerType === 'touch') {
      if (activeTouchPointerIdsRef.current.size > 0) {
        if (touchStrokeIndexRef.current !== null) {
          const next = visitorStrokesRef.current.filter(
            (_, index) => index !== touchStrokeIndexRef.current,
          );
          visitorStrokesRef.current = next;
          setVisitorHistory((history) => ({ ...history, present: next }));
          setVisitorStrokes(next);
        }
        touchStrokeIndexRef.current = null;
        visitorPointerIdRef.current = null;
        activeTouchPointerIdsRef.current.add(event.pointerId);
        return;
      }
      activeTouchPointerIdsRef.current.add(event.pointerId);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    visitorPointerIdRef.current = event.pointerId;
    const point = visitorPoint(event);
    if (visitorTool === 'eraser') {
      const remaining = visitorStrokesRef.current.filter(
        (stroke) => !visitorStrokeIntersects(stroke, point, visitorEraseRadius(stroke)),
      );
      if (remaining.length !== visitorStrokesRef.current.length) commitVisitorStrokes(remaining);
      setEraserPoint(point);
      return;
    }
    const stroke = {
      points: [point],
      tool: visitorTool,
      size: visitorSize * (event.pressure > 0 ? 0.5 + event.pressure : 1),
      color: visitorColor,
    };
    commitVisitorStrokes([...visitorStrokesRef.current, stroke]);
    if (event.pointerType === 'touch') {
      touchStrokeIndexRef.current = visitorStrokesRef.current.length - 1;
    }
  }

  function continueVisitorStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!visitorDrawOn || visitorPointerIdRef.current !== event.pointerId) return;
    const point = visitorPoint(event);
    if (visitorTool === 'eraser') {
      const remaining = visitorStrokesRef.current.filter(
        (stroke) => !visitorStrokeIntersects(stroke, point, visitorEraseRadius(stroke)),
      );
      if (remaining.length !== visitorStrokesRef.current.length) commitVisitorStrokes(remaining);
      setEraserPoint(point);
      return;
    }
    const strokes = visitorStrokesRef.current;
    const current = strokes[strokes.length - 1]?.points;
    if (!current) return;
    current.push(point);
    setVisitorStrokes([...strokes]);
  }

  function clearVisitorStrokes() {
    if (visitorStrokesRef.current.length > 0) commitVisitorStrokes([]);
  }

  function handleVisitorKeyDown(event: React.KeyboardEvent<HTMLCanvasElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    if (event.shiftKey) redoVisitorStrokes();
    else undoVisitorStrokes();
  }

  return {
    visitorDrawOn,
    setVisitorDrawOn,
    visitorTool,
    setVisitorTool,
    visitorSize,
    setVisitorSize,
    visitorColor,
    setVisitorColor,
    visitorStrokes,
    setVisitorStrokes,
    visitorHistory,
    setVisitorHistory,
    eraserPoint,
    setEraserPoint,
    visitorOverlayRef,
    visitorStrokesRef,
    visitorPointerIdRef,
    activeTouchPointerIdsRef,
    touchStrokeIndexRef,
    drawVisitorOverlay,
    updateVisitorOverlaySize,
    drawVisitorStroke,
    visitorStrokeWidth,
    visitorPoint,
    startVisitorStroke,
    continueVisitorStroke,
    clearVisitorStrokes,
    handleVisitorKeyDown,
    undoVisitorStrokes,
    redoVisitorStrokes,
  };
}
