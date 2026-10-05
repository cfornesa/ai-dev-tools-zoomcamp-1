import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

import type { Point } from './sceneShapes';

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.25;
export const ZOOM_EPSILON = 1e-6;

export function clampZoomValue(zoom: number): number {
  const rounded = Math.round(zoom * 100) / 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded));
}

export function getCanvasFitScale(
  viewportWidth: number,
  viewportHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
    return 1;
  }
  return Math.min(viewportWidth / canvasWidth, viewportHeight / canvasHeight);
}

export function clampPanValue(
  pan: Point,
  zoom: number,
  viewport: { width: number; height: number },
  contentSize?: { width: number; height: number },
): Point {
  const maxX = Math.max(0, ((contentSize?.width ?? viewport.width) * zoom - viewport.width) / 2);
  const maxY = Math.max(0, ((contentSize?.height ?? viewport.height) * zoom - viewport.height) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, pan.x)),
    y: Math.min(maxY, Math.max(-maxY, pan.y)),
  };
}

type CanvasSizeRef = MutableRefObject<{ width: number; height: number }>;

export function useCanvasViewport(canvasSizeRef: CanvasSizeRef) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [fitScale, setFitScale] = useState(1);
  const fitScaleRef = useRef(fitScale);
  fitScaleRef.current = fitScale;
  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const wheelCleanupRef = useRef<(() => void) | null>(null);

  const viewportCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      wheelCleanupRef.current?.();
      wheelCleanupRef.current = null;
      viewportRef.current = node;
      setViewportNode(node);
      if (!node) return;
      const onWheel = (event: WheelEvent) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        const next = clampZoomValue(zoomRef.current - event.deltaY * 0.001);
        setZoom(next);
        setPan((current) =>
          next <= 1
            ? { x: 0, y: 0 }
            : clampPanValue(current, next, node.getBoundingClientRect(), {
                width: canvasSizeRef.current.width * fitScaleRef.current,
                height: canvasSizeRef.current.height * fitScaleRef.current,
              }),
        );
      };
      node.addEventListener('wheel', onWheel, { passive: false });
      wheelCleanupRef.current = () => node.removeEventListener('wheel', onWheel);
    },
    [canvasSizeRef],
  );

  useEffect(() => {
    if (!viewportNode) return;
    const updateFit = () => {
      const rect = viewportNode.getBoundingClientRect();
      const styles = window.getComputedStyle(viewportNode);
      const cssPixels = (value: string) => Number.parseFloat(value) || 0;
      const horizontalPadding = cssPixels(styles.paddingLeft) + cssPixels(styles.paddingRight);
      const verticalPadding = cssPixels(styles.paddingTop) + cssPixels(styles.paddingBottom);
      const width = Math.max(0, rect.width - horizontalPadding);
      const height = Math.max(0, rect.height - verticalPadding);
      const { width: logicalWidth, height: logicalHeight } = canvasSizeRef.current;
      const nextFit = getCanvasFitScale(width, height, logicalWidth, logicalHeight);
      setFitScale((current) => (Math.abs(current - nextFit) < 0.0001 ? current : nextFit));
      setPan((current) =>
        zoomRef.current <= 1
          ? { x: 0, y: 0 }
          : clampPanValue(
              current,
              zoomRef.current,
              { width, height },
              {
                width: logicalWidth * fitScaleRef.current,
                height: logicalHeight * fitScaleRef.current,
              },
            ),
      );
    };
    updateFit();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updateFit) : null;
    observer?.observe(viewportNode);
    window.addEventListener('resize', updateFit);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateFit);
    };
  }, [canvasSizeRef, viewportNode]);

  const applyZoomChange = useCallback(
    (nextRaw: number) => {
      const next = clampZoomValue(nextRaw);
      setZoom(next);
      setPan((current) => {
        if (next <= 1) return { x: 0, y: 0 };
        const rect = viewportRef.current?.getBoundingClientRect();
        return rect
          ? clampPanValue(current, next, rect, {
              width: canvasSizeRef.current.width * fitScaleRef.current,
              height: canvasSizeRef.current.height * fitScaleRef.current,
            })
          : current;
      });
    },
    [canvasSizeRef],
  );

  const fitToViewport = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (rect) {
      const styles = window.getComputedStyle(viewportRef.current!);
      const cssPixels = (value: string) => Number.parseFloat(value) || 0;
      const width = Math.max(
        0,
        rect.width - cssPixels(styles.paddingLeft) - cssPixels(styles.paddingRight),
      );
      const height = Math.max(
        0,
        rect.height - cssPixels(styles.paddingTop) - cssPixels(styles.paddingBottom),
      );
      setFitScale(
        getCanvasFitScale(width, height, canvasSizeRef.current.width, canvasSizeRef.current.height),
      );
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [canvasSizeRef]);

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    fitScale,
    setFitScale,
    fitScaleRef,
    zoomRef,
    viewportRef,
    viewportCallbackRef,
    applyZoomChange,
    fitToViewport,
  };
}
