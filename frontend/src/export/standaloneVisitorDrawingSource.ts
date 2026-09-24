/**
 * Issues #757/#758: the C2.js Interactive visitor drawing toolset (live: `pages/visitorDrawing.ts`,
 * `visitorDrawingHistory.ts`, and `PieceStageControls.tsx`, closed #670/#707-#711) ported to a
 * standalone runtime for the downloaded ZIP. It stays session-only: strokes live in memory, nothing is
 * written to storage or the network, and a reload restores the stored piece.
 *
 * The overlay canvas is aligned with the artwork's *content* rectangle (the 1280x720 canvas after
 * `object-fit: contain` letterboxing in the immersive presentation), and strokes are stored as
 * coordinates normalised to that rectangle, so a stroke lands under the pointer at every viewport and
 * the screenshot composite matches what the visitor sees.
 */

const SWATCHES: Array<{ name: string; value: string }> = [
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#ffffff' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#facc15' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
];

/** The tools row, hidden until the visitor turns Draw on (contextual, matrix row 7). */
export function buildVisitorDrawingToolsMarkup(): string {
  const swatches = SWATCHES.map(
    (swatch) =>
      `<button type="button" role="radio" aria-checked="false" aria-label="${swatch.name}" class="art-piece-swatch" data-color="${swatch.value}" style="background:${swatch.value}"></button>`,
  ).join('');
  return `<div id="art-piece-drawing-tools" role="group" aria-label="Visitor drawing" hidden>
  <div role="radiogroup" aria-label="Stroke color" class="art-piece-swatches">${swatches}</div>
  <label class="art-piece-custom-color">Custom color <input id="art-piece-stroke-color" type="color" value="#ffffff" aria-label="Custom stroke color"></label>
  <div role="radiogroup" aria-label="Drawing tool" class="art-piece-tool-group">
    <button type="button" role="radio" aria-checked="true" data-tool="pencil">Pencil</button>
    <button type="button" role="radio" aria-checked="false" data-tool="brush">Brush</button>
    <button type="button" role="radio" aria-checked="false" data-tool="eraser">Eraser</button>
  </div>
  <label class="art-piece-size-control">Size <output id="art-piece-stroke-size-output">4px</output><input id="art-piece-stroke-size" type="range" min="1" max="40" step="1" value="4" aria-label="Drawing size"></label>
  <button type="button" data-action="draw-clear" aria-label="Clear visitor drawing" disabled>Clear</button>
  <button type="button" data-action="draw-undo" aria-label="Undo visitor drawing" disabled>Undo</button>
  <button type="button" data-action="draw-redo" aria-label="Redo visitor drawing" disabled>Redo</button>
</div>`;
}

export const VISITOR_DRAWING_CSS = `
#art-piece-drawing-tools {
  position: fixed;
  bottom: .75rem;
  left: .75rem;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .4rem;
  max-width: calc(100vw - 1.5rem);
  box-sizing: border-box;
  padding: .5rem;
  color: #fff;
  background: rgba(10,12,20,.94);
  border: 1px solid rgba(255,255,255,.5);
  border-radius: .75rem;
  font: 13px/1.3 system-ui, sans-serif;
}
#art-piece-drawing-tools[hidden] { display: none; }
#art-piece-drawing-tools button:not(.art-piece-swatch) {
  min-height: 2.75rem;
  padding: .3rem .7rem;
  border: 1px solid rgba(255,255,255,.7);
  border-radius: .75rem;
  background: rgba(10,12,20,.94);
  color: #fff;
  cursor: pointer;
}
#art-piece-drawing-tools button[aria-checked="true"] { background: rgba(59,74,120,.98); border-color: #fff; }
#art-piece-drawing-tools button:disabled { opacity: .5; cursor: default; }
.art-piece-swatches, .art-piece-tool-group { display: flex; flex-wrap: wrap; gap: .3rem; align-items: center; }
.art-piece-swatch { width: 2.75rem; height: 2.75rem; padding: 0; border: 2px solid rgba(255,255,255,.7); border-radius: 50%; cursor: pointer; }
.art-piece-swatch[aria-checked="true"] { border-color: #fff; box-shadow: 0 0 0 2px #3b82f6; }
.art-piece-custom-color, .art-piece-size-control { display: inline-flex; align-items: center; gap: .4rem; }
#art-piece-drawing-overlay { position: fixed; z-index: 5; pointer-events: none; touch-action: auto; }
`;

export function buildVisitorDrawingScript(): string {
  return `<script>
(function () {
  function init() {
    var art = document.getElementById('c2-canvas');
    var toggle = document.querySelector('[data-action="draw"]');
    var tools = document.getElementById('art-piece-drawing-tools');
    if (!art || !toggle || !tools) return;
    var overlay = document.createElement('canvas');
    overlay.id = 'art-piece-drawing-overlay';
    overlay.setAttribute('aria-label', 'Temporary visitor drawing overlay');
    overlay.tabIndex = 0;
    document.body.appendChild(overlay);

    var strokes = [];
    var past = [];
    var future = [];
    var tool = 'pencil';
    var color = '#ffffff';
    var size = 4;
    var drawOn = false;
    var pointerId = null;
    var touches = {};
    var touchCount = 0;
    var touchStrokeIndex = null;

    function bgColor() {
      var match = (getComputedStyle(document.body).backgroundColor || '').match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      if (!match) return '#ffffff';
      var luminance = (Number(match[1]) * 299 + Number(match[2]) * 587 + Number(match[3]) * 114) / 1000;
      return luminance > 140 ? '#000000' : '#ffffff';
    }
    color = bgColor();

    function content() {
      var rect = art.getBoundingClientRect();
      var scale = Math.min(rect.width / art.width, rect.height / art.height) || 1;
      var width = art.width * scale;
      var height = art.height * scale;
      return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width: width, height: height };
    }
    function strokeWidth(stroke, scale) { return stroke.size * scale * (stroke.tool === 'brush' ? 1.75 : 1); }
    function drawStroke(ctx, stroke, width, cw, ch) {
      if (!stroke.points.length) return;
      var first = stroke.points[0];
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = width;
      ctx.lineCap = stroke.tool === 'brush' ? 'round' : 'butt';
      ctx.lineJoin = stroke.tool === 'brush' ? 'round' : 'miter';
      if (stroke.points.length === 1) {
        ctx.beginPath();
        if (stroke.tool === 'brush') { ctx.arc(first.x * cw, first.y * ch, width / 2, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.fillRect(first.x * cw - width / 2, first.y * ch - width / 2, width, width); }
        return;
      }
      ctx.beginPath();
      ctx.moveTo(first.x * cw, first.y * ch);
      for (var i = 1; i < stroke.points.length; i += 1) ctx.lineTo(stroke.points[i].x * cw, stroke.points[i].y * ch);
      ctx.stroke();
    }
    function redraw() {
      var ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      strokes.forEach(function (stroke) { drawStroke(ctx, stroke, strokeWidth(stroke, overlay.width / 320), overlay.width, overlay.height); });
    }
    function layout() {
      var c = content();
      var dpr = window.devicePixelRatio || 1;
      overlay.style.left = c.left + 'px';
      overlay.style.top = c.top + 'px';
      overlay.style.width = c.width + 'px';
      overlay.style.height = c.height + 'px';
      var w = Math.max(1, Math.floor(c.width * dpr));
      var h = Math.max(1, Math.floor(c.height * dpr));
      if (overlay.width !== w || overlay.height !== h) { overlay.width = w; overlay.height = h; }
      redraw();
    }
    function syncButtons() {
      document.querySelector('[data-action="draw-clear"]').disabled = strokes.length === 0;
      document.querySelector('[data-action="draw-undo"]').disabled = past.length === 0;
      document.querySelector('[data-action="draw-redo"]').disabled = future.length === 0;
    }
    function commit(next) { past.push(strokes); strokes = next; future = []; redraw(); syncButtons(); }
    function intersects(stroke, point, radius) {
      for (var i = 0; i < stroke.points.length; i += 1) {
        var start = stroke.points[i];
        var end = stroke.points[i + 1] || start;
        var dx = end.x - start.x;
        var dy = end.y - start.y;
        var lengthSquared = dx * dx + dy * dy;
        var projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
        if (Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy)) <= radius) return true;
      }
      return false;
    }
    function eraseRadius(stroke) {
      var stageWidth = overlay.getBoundingClientRect().width || 320;
      var radius = size / (2 * stageWidth);
      return stroke ? radius + strokeWidth(stroke, stageWidth / 320) / (2 * stageWidth) : radius;
    }
    function pointOf(event) {
      var rect = overlay.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
      };
    }
    function eraseAt(point) {
      var remaining = strokes.filter(function (stroke) { return !intersects(stroke, point, eraseRadius(stroke)); });
      if (remaining.length !== strokes.length) commit(remaining);
    }

    overlay.addEventListener('pointerdown', function (event) {
      if (!drawOn) return;
      // Drawing owns the pointer: never let the immersive drag-look/orbit handlers also see it.
      event.stopPropagation();
      if (event.pointerType === 'touch') {
        if (touchCount > 0) {
          // A second finger cancels the stroke in progress so pinch/scroll never leaves a stray mark.
          if (touchStrokeIndex !== null) { strokes = strokes.filter(function (_, index) { return index !== touchStrokeIndex; }); redraw(); }
          touchStrokeIndex = null;
          pointerId = null;
          touches[event.pointerId] = true;
          touchCount += 1;
          return;
        }
        touches[event.pointerId] = true;
        touchCount += 1;
      }
      overlay.setPointerCapture(event.pointerId);
      pointerId = event.pointerId;
      var point = pointOf(event);
      if (tool === 'eraser') { eraseAt(point); return; }
      var pressure = event.pressure > 0 ? 0.5 + event.pressure : 1;
      commit(strokes.concat([{ points: [point], tool: tool, size: size * pressure, color: color }]));
      if (event.pointerType === 'touch') touchStrokeIndex = strokes.length - 1;
    });
    overlay.addEventListener('pointermove', function (event) {
      if (!drawOn || pointerId !== event.pointerId) return;
      event.stopPropagation();
      var point = pointOf(event);
      if (tool === 'eraser') { eraseAt(point); return; }
      var current = strokes[strokes.length - 1];
      if (!current) return;
      current.points.push(point);
      redraw();
    });
    function release(event) {
      if (drawOn) event.stopPropagation();
      if (pointerId === event.pointerId) pointerId = null;
      if (touches[event.pointerId]) { delete touches[event.pointerId]; touchCount = Math.max(0, touchCount - 1); }
      if (touchCount === 0) touchStrokeIndex = null;
      if (overlay.hasPointerCapture && overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId);
    }
    overlay.addEventListener('pointerup', release);
    overlay.addEventListener('pointercancel', release);
    overlay.addEventListener('wheel', function (event) { if (drawOn) event.stopPropagation(); }, { passive: true });
    overlay.addEventListener('keydown', function (event) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) doRedo(); else doUndo();
    });

    function doUndo() { if (!past.length) return; future.unshift(strokes); strokes = past.pop(); redraw(); syncButtons(); }
    function doRedo() { if (!future.length) return; past.push(strokes); strokes = future.shift(); redraw(); syncButtons(); }
    document.querySelector('[data-action="draw-undo"]').addEventListener('click', doUndo);
    document.querySelector('[data-action="draw-redo"]').addEventListener('click', doRedo);
    document.querySelector('[data-action="draw-clear"]').addEventListener('click', function () { if (strokes.length) commit([]); });

    function setDrawOn(next) {
      drawOn = next;
      toggle.setAttribute('aria-pressed', String(drawOn));
      var label = drawOn ? 'Stop drawing' : 'Draw on piece';
      toggle.setAttribute('aria-label', label);
      var tip = toggle.querySelector('.piece-stage-tooltip');
      if (tip) tip.textContent = label;
      tools.hidden = !drawOn;
      overlay.style.pointerEvents = drawOn ? 'auto' : 'none';
      overlay.style.touchAction = drawOn ? 'none' : 'auto';
      layout();
    }
    toggle.addEventListener('click', function () { setDrawOn(!drawOn); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && drawOn && document.activeElement === overlay) { setDrawOn(false); toggle.focus(); }
    });

    var swatchButtons = Array.prototype.slice.call(tools.querySelectorAll('.art-piece-swatch'));
    function markSwatches() {
      swatchButtons.forEach(function (button) { button.setAttribute('aria-checked', String(button.getAttribute('data-color') === color)); });
    }
    swatchButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        color = button.getAttribute('data-color');
        document.getElementById('art-piece-stroke-color').value = color;
        markSwatches();
      });
    });
    document.getElementById('art-piece-stroke-color').value = color;
    markSwatches();
    document.getElementById('art-piece-stroke-color').addEventListener('input', function (event) {
      color = event.target.value;
      markSwatches();
    });
    var toolButtons = Array.prototype.slice.call(tools.querySelectorAll('[data-tool]'));
    toolButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        tool = button.getAttribute('data-tool');
        toolButtons.forEach(function (other) { other.setAttribute('aria-checked', String(other === button)); });
      });
    });
    document.getElementById('art-piece-stroke-size').addEventListener('input', function (event) {
      size = Number(event.target.value);
      document.getElementById('art-piece-stroke-size-output').textContent = size + 'px';
    });

    // Screenshot composes the marks over the artwork so a captured image shows what the visitor sees.
    window.__artPieceScreenshotExtras = (window.__artPieceScreenshotExtras || []).concat([
      function (ctx, width, height) {
        strokes.forEach(function (stroke) { drawStroke(ctx, stroke, strokeWidth(stroke, width / 320), width, height); });
      }
    ]);
    window.__artPieceVisitorDrawing = { strokeCount: function () { return strokes.length; } };

    window.addEventListener('resize', layout);
    if (typeof ResizeObserver === 'function') new ResizeObserver(layout).observe(art);
    layout();
    syncButtons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
</script>`;
}
