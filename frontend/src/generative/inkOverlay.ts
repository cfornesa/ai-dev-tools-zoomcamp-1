/**
 * Issue #776: renders a generated 2D piece's ink layer (a `drawingDocument`, the same vocabulary as a 3D
 * drawing plane) *over* the piece without touching its generated source. The block is markup + a small
 * script appended to a sandbox or ZIP document:
 *
 * - an `<svg id="art-piece-ink-overlay">` positioned over the artwork's content rectangle (the canvas or
 *   svg after `object-fit: contain` letterboxing), so ink lands where it was drawn at every viewport;
 * - a painter registered on `window.__artPieceScreenshotExtras` so screenshots include the ink.
 *
 * Nothing from the ink document reaches the markup unvalidated: numbers must be finite and colours must
 * match a strict hex pattern, everything else is dropped, so a hostile stored document cannot inject
 * script or attributes.
 */
import type { DrawingDocument, DrawingShape } from '../pages/scene3dTypes';

export const INK_OVERLAY_ID = 'art-piece-ink-overlay';

const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_SHAPES = 500;
const MAX_POINTS = 2000;

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(-100000, Math.min(100000, v)) : fallback;
const color = (v: unknown): string | null => (typeof v === 'string' && COLOR.test(v) ? v : null);

function cleanShape(raw: unknown): DrawingShape | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const style = {
    fill: color(s.fill),
    stroke: color(s.stroke),
    strokeWidth: Math.max(0, Math.min(256, num(s.strokeWidth, 0))),
    opacity: Math.max(0, Math.min(1, num(s.opacity, 1))),
  };
  const id = typeof s.id === 'string' && ID.test(s.id) ? s.id : 'ink';
  switch (s.type) {
    case 'rect':
      return {
        id,
        type: 'rect',
        x: num(s.x),
        y: num(s.y),
        width: Math.abs(num(s.width)),
        height: Math.abs(num(s.height)),
        ...style,
      };
    case 'ellipse':
      return {
        id,
        type: 'ellipse',
        cx: num(s.cx),
        cy: num(s.cy),
        rx: Math.abs(num(s.rx)),
        ry: Math.abs(num(s.ry)),
        ...style,
      };
    case 'line':
      return {
        id,
        type: 'line',
        x1: num(s.x1),
        y1: num(s.y1),
        x2: num(s.x2),
        y2: num(s.y2),
        ...style,
      };
    case 'path': {
      if (!Array.isArray(s.points)) return null;
      const points = s.points.slice(0, MAX_POINTS).map((p) => ({
        x: num((p as Record<string, unknown>)?.x),
        y: num((p as Record<string, unknown>)?.y),
      }));
      return points.length === 0
        ? null
        : { id, type: 'path', points, closed: s.closed === true, ...style };
    }
    default:
      return null;
  }
}

/** A safe copy of `raw` as a drawing document, or null when it isn't one. */
export function sanitizeInk(raw: unknown): DrawingDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const doc = raw as Record<string, unknown>;
  const width = num(doc.width);
  const height = num(doc.height);
  if (width < 1 || height < 1 || !Array.isArray(doc.shapes)) return null;
  const shapes = doc.shapes
    .slice(0, MAX_SHAPES)
    .map(cleanShape)
    .filter((s): s is DrawingShape => s !== null);
  return shapes.length === 0 ? null : { width, height, background: null, shapes };
}

const f = (n: number) => String(Math.round(n * 100) / 100);

function shapeMarkup(shape: DrawingShape): string {
  const paint = [
    `fill="${shape.fill ?? 'none'}"`,
    shape.stroke && (shape.strokeWidth ?? 0) > 0
      ? `stroke="${shape.stroke}" stroke-width="${f(shape.strokeWidth ?? 0)}" stroke-linecap="round" stroke-linejoin="round"`
      : 'stroke="none"',
    (shape.opacity ?? 1) < 1 ? `opacity="${f(shape.opacity ?? 1)}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  switch (shape.type) {
    case 'rect':
      return `<rect x="${f(shape.x)}" y="${f(shape.y)}" width="${f(shape.width)}" height="${f(shape.height)}" ${paint}/>`;
    case 'ellipse':
      return `<ellipse cx="${f(shape.cx)}" cy="${f(shape.cy)}" rx="${f(shape.rx)}" ry="${f(shape.ry)}" ${paint}/>`;
    case 'line':
      return `<line x1="${f(shape.x1)}" y1="${f(shape.y1)}" x2="${f(shape.x2)}" y2="${f(shape.y2)}" ${paint}/>`;
    case 'path': {
      const d = shape.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)} ${f(p.y)}`).join(' ');
      return `<path d="${d}${shape.closed ? ' Z' : ''}" ${paint}/>`;
    }
  }
}

const OVERLAY_CSS = `#${INK_OVERLAY_ID}{position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:4;overflow:hidden}`;

/** The style + svg + script block to append before `</body>`; empty when `ink` is absent or invalid. */
export function buildInkOverlayBlock(ink: unknown): string {
  const doc = sanitizeInk(ink);
  if (!doc) return '';
  const svg = `<svg id="${INK_OVERLAY_ID}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" viewBox="0 0 ${f(doc.width)} ${f(doc.height)}" preserveAspectRatio="none">${doc.shapes.map(shapeMarkup).join('')}</svg>`;
  const data = JSON.stringify(doc).replace(/</g, '\\u003c');
  return `<style>${OVERLAY_CSS}</style>
${svg}
<script>
(function () {
  var ink = ${data};
  var svg = document.getElementById('${INK_OVERLAY_ID}');
  if (!svg) return;
  function art() {
    return document.querySelector('canvas:not(#art-piece-drawing-overlay), svg:not(#${INK_OVERLAY_ID}):not(.piece-stage-icon)');
  }
  // The artwork's content rectangle: the element box minus object-fit: contain letterboxing.
  function content(el) {
    var rect = el.getBoundingClientRect();
    var nw = el.width || (el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal.width) || 0;
    var nh = el.height || (el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal.height) || 0;
    if (typeof nw === 'object' && nw.baseVal) nw = nw.baseVal.value;
    if (typeof nh === 'object' && nh.baseVal) nh = nh.baseVal.value;
    if (!nw || !nh) return rect;
    var scale = Math.min(rect.width / nw, rect.height / nh) || 1;
    var w = nw * scale, h = nh * scale;
    return { left: rect.left + (rect.width - w) / 2, top: rect.top + (rect.height - h) / 2, width: w, height: h };
  }
  function place() {
    var el = art();
    if (!el) return;
    var r = content(el);
    svg.style.left = r.left + 'px';
    svg.style.top = r.top + 'px';
    svg.style.width = r.width + 'px';
    svg.style.height = r.height + 'px';
  }
  place();
  window.addEventListener('resize', place);
  window.addEventListener('load', place);
  setInterval(place, 400);
  function paint(ctx, w, h) {
    var sx = w / ink.width, sy = h / ink.height;
    ink.shapes.forEach(function (s) {
      ctx.save();
      ctx.globalAlpha = s.opacity == null ? 1 : s.opacity;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = (s.strokeWidth || 0) * Math.min(sx, sy);
      ctx.beginPath();
      if (s.type === 'rect') ctx.rect(s.x * sx, s.y * sy, s.width * sx, s.height * sy);
      else if (s.type === 'ellipse') ctx.ellipse(s.cx * sx, s.cy * sy, s.rx * sx, s.ry * sy, 0, 0, Math.PI * 2);
      else if (s.type === 'line') { ctx.moveTo(s.x1 * sx, s.y1 * sy); ctx.lineTo(s.x2 * sx, s.y2 * sy); }
      else { s.points.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x * sx, p.y * sy); else ctx.lineTo(p.x * sx, p.y * sy); }); if (s.closed) ctx.closePath(); }
      if (s.fill && s.type !== 'line') { ctx.fillStyle = s.fill; ctx.fill(); }
      if (s.stroke && s.strokeWidth > 0) { ctx.strokeStyle = s.stroke; ctx.stroke(); }
      ctx.restore();
    });
  }
  window.__artPieceInkPaint = paint;
  window.__artPieceScreenshotExtras = (window.__artPieceScreenshotExtras || []).concat([paint]);
})();
</script>`;
}

/** Inserts `block` immediately before the document's closing `</body>` (or appends it). */
export function injectBeforeBodyEnd(html: string, block: string): string {
  if (!block) return html;
  const index = html.lastIndexOf('</body>');
  return index === -1 ? html + block : `${html.slice(0, index)}${block}\n${html.slice(index)}`;
}
