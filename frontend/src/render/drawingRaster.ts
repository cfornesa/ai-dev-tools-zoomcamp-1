/**
 * Issues #779/#780: rasterises a drawing plane's vector drawing (`scene3d` `drawingPlane.drawing`, #778)
 * into a 2D canvas. Both 3D renderers use the result as the plane's texture: the Three.js builder wraps the
 * canvas in a `CanvasTexture`, and the A-Frame markup builder embeds its PNG data URL, so the two engines
 * show identical pixels for the same drawing.
 *
 * Shapes are painted bottom to top in the drawing's own pixel space (origin top-left, y down). Only the
 * closed shape vocabulary the schema allows is handled, and every colour is re-validated here so a
 * document that somehow bypassed validation cannot inject an arbitrary CSS colour string.
 */
import type { DrawingDocument, DrawingShape } from '../pages/scene3dTypes';

const COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

function safeColor(value: unknown): string | null {
  return typeof value === 'string' && COLOR_PATTERN.test(value) ? value : null;
}

function applyStyle(
  ctx: CanvasRenderingContext2D,
  shape: DrawingShape,
): { fill: boolean; stroke: boolean } {
  const fill = safeColor(shape.fill);
  const stroke = safeColor(shape.stroke);
  const strokeWidth = Math.max(0, Number(shape.strokeWidth ?? 0));
  ctx.globalAlpha = Math.min(1, Math.max(0, shape.opacity ?? 1));
  if (fill) ctx.fillStyle = fill;
  if (stroke && strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }
  return { fill: Boolean(fill), stroke: Boolean(stroke) && strokeWidth > 0 };
}

/** Paints `drawing` into `ctx`, which must already be sized `drawing.width` x `drawing.height`. */
export function paintDrawing(ctx: CanvasRenderingContext2D, drawing: DrawingDocument): void {
  ctx.clearRect(0, 0, drawing.width, drawing.height);
  const background = safeColor(drawing.background);
  if (background) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, drawing.width, drawing.height);
  }
  for (const shape of drawing.shapes) {
    ctx.save();
    const { fill, stroke } = applyStyle(ctx, shape);
    ctx.beginPath();
    if (shape.type === 'rect') {
      ctx.rect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === 'ellipse') {
      ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
    } else if (shape.type === 'line') {
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x2, shape.y2);
    } else {
      shape.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      if (shape.closed) ctx.closePath();
    }
    // A line has no interior, so only its stroke is drawn.
    if (fill && shape.type !== 'line') ctx.fill();
    if (stroke) ctx.stroke();
    ctx.restore();
  }
}

/** A fresh canvas with the drawing painted onto it, or null when 2D canvas is unavailable. */
export function rasterizeDrawing(drawing: DrawingDocument): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = drawing.width;
  canvas.height = drawing.height;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  paintDrawing(ctx, drawing);
  return canvas;
}

/**
 * #787: the same painter as `paintDrawing`, as plain JS source for the standalone (ZIP/HTML) Three.js
 * runtime, which cannot import this module. Defines `scene3dPaintDrawing(ctx, drawing)`. A unit test drives
 * both with a recording 2D context so the two cannot drift.
 */
export const DRAWING_PAINTER_SOURCE = `
function scene3dSafeColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : null;
}
function scene3dPaintDrawing(ctx, drawing) {
  ctx.clearRect(0, 0, drawing.width, drawing.height);
  var background = scene3dSafeColor(drawing.background);
  if (background) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, drawing.width, drawing.height);
  }
  for (var i = 0; i < drawing.shapes.length; i += 1) {
    var shape = drawing.shapes[i];
    ctx.save();
    var fill = scene3dSafeColor(shape.fill);
    var stroke = scene3dSafeColor(shape.stroke);
    var strokeWidth = Math.max(0, Number(shape.strokeWidth == null ? 0 : shape.strokeWidth));
    ctx.globalAlpha = Math.min(1, Math.max(0, shape.opacity == null ? 1 : shape.opacity));
    if (fill) ctx.fillStyle = fill;
    if (stroke && strokeWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
    }
    var doFill = Boolean(fill);
    var doStroke = Boolean(stroke) && strokeWidth > 0;
    ctx.beginPath();
    if (shape.type === 'rect') {
      ctx.rect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === 'ellipse') {
      ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
    } else if (shape.type === 'line') {
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x2, shape.y2);
    } else {
      for (var p = 0; p < shape.points.length; p += 1) {
        if (p === 0) ctx.moveTo(shape.points[p].x, shape.points[p].y);
        else ctx.lineTo(shape.points[p].x, shape.points[p].y);
      }
      if (shape.closed) ctx.closePath();
    }
    if (doFill && shape.type !== 'line') ctx.fill();
    if (doStroke) ctx.stroke();
    ctx.restore();
  }
}
`;
