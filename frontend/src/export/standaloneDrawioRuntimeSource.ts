/** Small dependency-free runtime for the supported draw.io export subset. */
export function buildStandaloneDrawioRuntimeScript(): string {
  return `
(function () {
  "use strict";
  var scene = JSON.parse(document.getElementById("scene-data").textContent);
  var host = document.getElementById("scene-canvas-host");
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");
  var c = scene.canvas || {};
  canvas.width = c.width || 800;
  canvas.height = c.height || 600;
  canvas.setAttribute("aria-label", "Draw.io scene");
  host.appendChild(canvas);
  ctx.fillStyle = c.backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  var drawio = scene.drawio || { layers: [], objects: [] };
  var visible = {};
  var layerOrder = {};
  (drawio.layers || []).forEach(function (layer) { if (layer.visible) visible[layer.id] = true; layerOrder[layer.id] = layer.order; });
  (drawio.objects || []).slice().sort(function (a, b) { return (layerOrder[b.layerId] || 0) - (layerOrder[a.layerId] || 0); }).forEach(function (o) {
    if (!visible[o.layerId]) return;
    if (o.type === "rect") {
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(o.x, o.y, o.width, o.height); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.strokeRect(o.x, o.y, o.width, o.height); }
    } else if (o.type === "ellipse") {
      ctx.beginPath(); ctx.ellipse(o.x + o.width / 2, o.y + o.height / 2, o.width / 2, o.height / 2, 0, 0, Math.PI * 2);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.stroke(); }
    } else if (o.type === "line") {
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.width, o.y + o.height);
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.stroke(); }
    } else if (o.type === "text" && o.text) {
      ctx.fillStyle = o.fill || "#111111"; ctx.font = "16px sans-serif";
      ctx.fillText(o.text, o.x, o.y + Math.max(16, o.height));
    }
  });
}());`;
}
