/**
 * Issue #207: the SVG counterpart of `standaloneRuntimeSource.ts`/
 * `standaloneCanvas2DRuntimeSource.ts` -- the "compact runtime" embedded
 * verbatim as plain JavaScript inside every exported standalone HTML page
 * for a scene whose `renderer.preferred` is `"svg"`.
 *
 * ## Why a separate file, not a branch inside the other two
 *
 * Every section outside the rendering helpers and final DOM-setup/draw-loop
 * wiring (the bindings runtime, the demo signal controller, the demo-
 * controls DOM, reduced-motion handling) is genuinely renderer-agnostic and
 * is reproduced here unchanged -- see `standaloneRuntimeSource.ts`'s module
 * doc comment for why this whole runtime is hand-written plain JS rather
 * than a bundled copy of the app's TypeScript. Only the rendering
 * primitives and the final setup/draw-loop wiring differ, mirroring how
 * `frontend/src/render/svgAdapter.ts` differs from the other two adapters
 * for the app's own live preview.
 *
 * ## Unlike the live editor's `svgAdapter.ts`, no canvas mirror here
 *
 * `svgAdapter.ts` keeps a private Canvas2D-adapter mirror purely so
 * `getCanvasElement()`/`captureSocialThumbnail.ts` keep working -- an
 * editor-only concern. An exported standalone page never calls either, so
 * this runtime only needs the SVG DOM update logic; there is no offscreen
 * canvas anywhere in this file's output.
 *
 * ## A real simplification versus the p5 export
 *
 * Like the Canvas2D export, this runtime needs **no external dependency at
 * all** -- native SVG DOM APIs are a browser built-in.
 * `generateHtmlExport.ts` omits the CDN `<script>` tag entirely for an
 * svg-renderer export.
 *
 * See `standaloneRuntimeSource.ts`'s module doc comment for the full,
 * still-applicable "Scope and limitations" section (bindings-only behavior
 * evaluation, demo signal vocabulary, no MediaPipe/camera in this module)
 * -- none of that differs by renderer.
 */

/** Identical to the other two runtime builders' own copy -- see
 * `standaloneRuntimeSource.ts`'s doc comment for provenance. */
const DEMO_PLAYBACK_SCRIPT = [
  { t: 0, x: 0.5, y: 0.5, present: true, event: 'handAppear' },
  { t: 100, x: 0.25, y: 0.4, present: true, event: null },
  { t: 200, x: 0.75, y: 0.35, present: true, event: null },
  { t: 300, x: 0.75, y: 0.35, present: true, event: null },
  { t: 400, x: 0.75, y: 0.35, present: true, event: 'pinchStart' },
  { t: 500, x: 0.75, y: 0.35, present: true, event: 'pinchEnd' },
  { t: 600, x: 0.5, y: 0.5, present: true, event: 'gestureEnter', gesture: 'openPalm' },
  { t: 700, x: 0.5, y: 0.5, present: true, event: 'gestureExit', gesture: 'openPalm' },
  { t: 800, x: 0.5, y: 0.5, present: false, event: 'handDisappear' },
] as const;

/** Returns the compact SVG runtime as a plain-JS source string, ready to be
 * wrapped in a `<script>` tag by `generateHtmlExport.ts`. Same scene/
 * config-data contract as the other two runtime builders. */
export function buildStandaloneSvgRuntimeScript(): string {
  return `
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var SCENE = JSON.parse(document.getElementById("scene-data").textContent);
  var CONFIG = JSON.parse(document.getElementById("export-config").textContent);
  var PLAYBACK_SCRIPT = ${JSON.stringify(DEMO_PLAYBACK_SCRIPT)};

  // ---------------------------------------------------------------------
  // Rendering: compact port of sceneDrawPlan.ts + svgAdapter.ts. Trusts
  // the embedded scene's structure (already validated before export, and
  // never user-editable after export), so this omits that source's
  // defensive structural pre-pass -- it only needs to *draw*, not
  // validate untrusted input.
  // ---------------------------------------------------------------------

  function parseColor(hex) {
    var h = hex.slice(1);
    if (h.length === 3) {
      h = h.split("").map(function (c) { return c + c; }).join("");
    }
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    var a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r: r, g: g, b: b, a: a };
  }

  function rgba(hex) {
    var c = parseColor(hex);
    return "rgba(" + c.r + ", " + c.g + ", " + c.b + ", " + c.a + ")";
  }

  function buildDrawPlan(scene) {
    var layers = Array.isArray(scene.layers) ? scene.layers : [];
    var groups = Array.isArray(scene.groups) ? scene.groups : [];
    var shapes = Array.isArray(scene.shapes) ? scene.shapes : [];
    var shapesById = {};
    var groupsById = {};
    shapes.forEach(function (s) { shapesById[s.id] = s; });
    groups.forEach(function (g) { groupsById[g.id] = g; });

    function isGroupTopLevel(groupId) {
      return !groups.some(function (g) {
        return Array.isArray(g.childIds) && g.childIds.indexOf(groupId) !== -1;
      });
    }

    function buildGroupNode(group) {
      var children = [];
      (group.childIds || []).forEach(function (cid) {
        if (Object.prototype.hasOwnProperty.call(shapesById, cid)) {
          children.push({ kind: "shape", shape: shapesById[cid] });
        } else if (Object.prototype.hasOwnProperty.call(groupsById, cid)) {
          children.push(buildGroupNode(groupsById[cid]));
        }
      });
      return { kind: "group", group: group, children: children };
    }

    var sortedLayers = layers.slice().sort(function (a, b) { return a.order - b.order; });
    var nodes = [];
    sortedLayers.forEach(function (layer) {
      if (!layer.visible) return;
      var topGroups = groups.filter(function (g) {
        return g.layerId === layer.id && isGroupTopLevel(g.id);
      });
      var topShapes = shapes.filter(function (s) {
        return s.layerId === layer.id && (s.groupId === null || s.groupId === undefined);
      });
      topGroups.forEach(function (g) { nodes.push(buildGroupNode(g)); });
      topShapes.forEach(function (s) { nodes.push({ kind: "shape", shape: s }); });
    });

    return {
      canvas: scene.canvas,
      randomness: scene.randomness || { seed: 0, enabled: false },
      layers: layers,
      nodes: nodes,
    };
  }

  function svgEl(tag) {
    return document.createElementNS(SVG_NS, tag);
  }

  function transformAttr(t) {
    return "translate(" + t.x + " " + t.y + ") rotate(" + t.rotation + ") scale(" + t.scaleX + " " + t.scaleY + ")";
  }

  function applyStyleAttrs(node, shape) {
    var style = shape.style;
    node.setAttribute("fill", style.fill === null ? "none" : rgba(style.fill));
    node.setAttribute("stroke", style.stroke === null ? "none" : rgba(style.stroke));
    node.setAttribute("stroke-width", String(style.strokeWidth));
    node.setAttribute("opacity", String(shape.transform.opacity));
    node.setAttribute("transform", transformAttr(shape.transform));
  }

  function buildShapeElement(shape) {
    switch (shape.type) {
      case "circle": {
        var c = svgEl("circle");
        c.setAttribute("cx", "0");
        c.setAttribute("cy", "0");
        c.setAttribute("r", String(shape.radius));
        applyStyleAttrs(c, shape);
        return c;
      }
      case "rect": {
        var r = svgEl("rect");
        r.setAttribute("x", "0");
        r.setAttribute("y", "0");
        r.setAttribute("width", String(shape.width));
        r.setAttribute("height", String(shape.height));
        r.setAttribute("rx", String(shape.cornerRadius));
        r.setAttribute("ry", String(shape.cornerRadius));
        applyStyleAttrs(r, shape);
        return r;
      }
      case "line": {
        var l = svgEl("line");
        l.setAttribute("x1", "0");
        l.setAttribute("y1", "0");
        l.setAttribute("x2", String(shape.x2 - shape.transform.x));
        l.setAttribute("y2", String(shape.y2 - shape.transform.y));
        l.setAttribute("stroke", shape.style.stroke === null ? "none" : rgba(shape.style.stroke));
        l.setAttribute("stroke-width", String(shape.style.strokeWidth));
        l.setAttribute("opacity", String(shape.transform.opacity));
        l.setAttribute("transform", transformAttr(shape.transform));
        return l;
      }
      case "path": {
        var p = svgEl("path");
        var points = shape.points || [];
        var d = "";
        if (points.length > 0) {
          d = "M " + points[0].x + " " + points[0].y + " ";
          d += points.slice(1).map(function (pt) { return "L " + pt.x + " " + pt.y; }).join(" ");
          if (shape.closed) d += " Z";
        }
        p.setAttribute("d", d);
        applyStyleAttrs(p, shape);
        return p;
      }
      case "particleEmitter": {
        var pe = svgEl("circle");
        pe.setAttribute("cx", "0");
        pe.setAttribute("cy", "0");
        pe.setAttribute("r", String(shape.size / 2));
        if (shape.palette && shape.palette.length > 0) {
          pe.setAttribute("fill", rgba(shape.palette[0]));
        } else {
          pe.setAttribute("fill", shape.style.fill === null ? "none" : rgba(shape.style.fill));
        }
        pe.setAttribute("stroke", shape.style.stroke === null ? "none" : rgba(shape.style.stroke));
        pe.setAttribute("stroke-width", String(shape.style.strokeWidth));
        pe.setAttribute("transform", transformAttr(shape.transform));
        return pe;
      }
      default:
        return svgEl("g");
    }
  }

  function buildNodeElement(node) {
    if (node.kind === "shape") return buildShapeElement(node.shape);
    var g = svgEl("g");
    if (!node.group.visible) {
      g.setAttribute("display", "none");
      return g;
    }
    g.setAttribute("transform", transformAttr(node.group.transform));
    g.setAttribute("opacity", String(node.group.transform.opacity));
    node.children.forEach(function (child) { g.appendChild(buildNodeElement(child)); });
    return g;
  }

  function layerOrderForNode(plan, node) {
    var layerId = node.kind === "shape" ? node.shape.layerId : node.group.layerId;
    var layer = (plan.layers || []).find(function (candidate) { return candidate.id === layerId; });
    return layer ? layer.order : Infinity;
  }

  function buildCameraOverlayElement(overlay, image, width, height) {
    if (!image || !image.complete || image.naturalWidth <= 0) return null;
    var x = overlay.geometry.x * width;
    var y = overlay.geometry.y * height;
    var w = overlay.geometry.width * width;
    var h = overlay.geometry.height * height;
    var foreignObject = svgEl("foreignObject");
    foreignObject.setAttribute("x", String(x));
    foreignObject.setAttribute("y", String(y));
    foreignObject.setAttribute("width", String(w));
    foreignObject.setAttribute("height", String(h));
    foreignObject.setAttribute("opacity", String(overlay.opacity));
    var canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (overlay.mirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    foreignObject.appendChild(canvas);
    return foreignObject;
  }

  // ---------------------------------------------------------------------
  // Bindings runtime: compact port of behaviorRuntime.ts's "path 1"
  // (scene.bindings) evaluation -- identical to the other two runtime
  // builders' copy; see standaloneRuntimeSource.ts's module doc comment
  // for scope.
  // ---------------------------------------------------------------------

  var REFERENCE_TICK_MS = 1000 / 60;
  var EVENT_COOLDOWN_MS = 150;
  var MAX_EVENTS_PER_SECOND = 10;

  var NUMERIC_TARGET_RANGES = {
    positionX: [-100000, 100000],
    positionY: [-100000, 100000],
    scaleX: [0, 100],
    scaleY: [0, 100],
    rotation: [-360, 360],
    opacity: [0, 1],
  };
  var COLOR_TARGET_PROPERTIES = { fill: true, stroke: true, backgroundColor: true };

  function clampNum(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampToTargetRange(targetProperty, value) {
    if (COLOR_TARGET_PROPERTIES[targetProperty]) {
      return typeof value === "string" ? value : null;
    }
    var range = NUMERIC_TARGET_RANGES[targetProperty];
    if (!range) return null;
    if (typeof value !== "number" || !isFinite(value)) return null;
    return clampNum(value, range[0], range[1]);
  }

  function toNumericSignal(value) {
    if (typeof value === "number" && isFinite(value)) return value;
    if (typeof value === "boolean") return value ? 1 : 0;
    return null;
  }

  function readMapping(binding) {
    var m = binding.mapping;
    if (
      m &&
      typeof m.inMin === "number" &&
      typeof m.inMax === "number" &&
      typeof m.outMin === "number" &&
      typeof m.outMax === "number" &&
      m.inMax !== m.inMin
    ) {
      return m;
    }
    return null;
  }

  function applyMapping(raw, mapping) {
    if (!mapping) return raw;
    var t = clampNum((raw - mapping.inMin) / (mapping.inMax - mapping.inMin), 0, 1);
    return mapping.outMin + t * (mapping.outMax - mapping.outMin);
  }

  function createBindingsRuntime(scene) {
    var bindings = Array.isArray(scene.bindings) ? scene.bindings : [];
    var smoothingState = {};
    var eventState = {};

    function evaluateContinuous(binding, input) {
      var raw = toNumericSignal(input.signals[binding.signal]);
      if (raw === null) return null;
      var mapped = applyMapping(raw, readMapping(binding));
      var smoothing = typeof binding.smoothing === "number" ? clampNum(binding.smoothing, 0, 1) : 0;
      var bindingId = String(binding.id);
      var outputValue = mapped;
      if (smoothing > 0) {
        var prior = smoothingState[bindingId];
        if (!prior) {
          outputValue = mapped;
        } else {
          var dt = Math.max(0, input.timestamp - prior.lastTimestamp);
          var alpha = 1 - Math.pow(1 - smoothing, dt / REFERENCE_TICK_MS);
          outputValue = prior.value + alpha * (mapped - prior.value);
        }
        smoothingState[bindingId] = { value: outputValue, lastTimestamp: input.timestamp };
      } else {
        delete smoothingState[bindingId];
      }
      var clamped = clampToTargetRange(binding.targetProperty, outputValue);
      if (clamped === null) return null;
      return {
        bindingId: bindingId,
        targetScope: binding.targetScope,
        targetId: binding.targetId || null,
        targetProperty: binding.targetProperty,
        value: clamped,
      };
    }

    function evaluateEvent(binding, input) {
      if (input.events.indexOf(binding.signal) === -1) return null;
      var bindingId = String(binding.id);
      var state = eventState[bindingId] || { lastFiredAt: null, firedTimestamps: [] };
      if (state.lastFiredAt !== null && input.timestamp - state.lastFiredAt < EVENT_COOLDOWN_MS) {
        return null;
      }
      var windowStart = input.timestamp - 1000;
      var recent = state.firedTimestamps.filter(function (t) { return t > windowStart; });
      if (recent.length >= MAX_EVENTS_PER_SECOND) {
        eventState[bindingId] = { lastFiredAt: state.lastFiredAt, firedTimestamps: recent };
        return null;
      }
      recent.push(input.timestamp);
      eventState[bindingId] = { lastFiredAt: input.timestamp, firedTimestamps: recent };
      return {
        bindingId: bindingId,
        targetScope: binding.targetScope,
        targetId: binding.targetId || null,
        targetProperty: binding.targetProperty,
        timestamp: input.timestamp,
      };
    }

    function tick(input) {
      var continuous = [];
      var events = [];
      bindings.forEach(function (binding) {
        if (typeof binding.signal === "string" && binding.signal.indexOf("event:") === 0) {
          var fired = evaluateEvent(binding, input);
          if (fired) events.push(fired);
        } else {
          var out = evaluateContinuous(binding, input);
          if (out) continuous.push(out);
        }
      });
      return { continuous: continuous, events: events };
    }

    return { tick: tick };
  }

  /** Compact port of applyRuntimeOutputsToScene: patches continuous
   * outputs onto a fresh copy of the scene's shapes/groups/canvas so the
   * renderer draws the current (bound) state, never the base authored
   * state, once bindings are active. */
  function applyOutputsToScene(scene, continuous) {
    if (continuous.length === 0) return scene;
    var shapes = (scene.shapes || []).slice();
    var groups = (scene.groups || []).slice();
    var canvas = Object.assign({}, scene.canvas);
    var canvasChanged = false;

    function patch(list, output) {
      var index = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === output.targetId) { index = i; break; }
      }
      if (index === -1) return list;
      var next = list.slice();
      var item = Object.assign({}, next[index]);
      if (COLOR_TARGET_PROPERTIES[output.targetProperty] && output.targetProperty !== "backgroundColor") {
        item.style = Object.assign({}, item.style);
        item.style[output.targetProperty] = output.value;
      } else {
        var field =
          output.targetProperty === "positionX" ? "x" :
          output.targetProperty === "positionY" ? "y" :
          output.targetProperty;
        item.transform = Object.assign({}, item.transform);
        item.transform[field] = output.value;
      }
      next[index] = item;
      return next;
    }

    continuous.forEach(function (output) {
      if (output.targetScope === "shape") {
        shapes = patch(shapes, output);
      } else if (output.targetScope === "group") {
        groups = patch(groups, output);
      } else if (output.targetScope === "scene" && output.targetProperty === "backgroundColor") {
        canvas.backgroundColor = output.value;
        canvasChanged = true;
      }
    });

    var next = Object.assign({}, scene, { shapes: shapes, groups: groups });
    if (canvasChanged) next.canvas = canvas;
    return next;
  }

  // ---------------------------------------------------------------------
  // Reduced motion: identical to the other two runtime builders' copy.
  // ---------------------------------------------------------------------

  function systemPrefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  var sceneReducedMotionSetting =
    (SCENE.accessibility && SCENE.accessibility.reducedMotion) || "auto";
  var manualMotionOverride = "system"; // 'system' | 'reduced' | 'full'

  function effectiveReducedMotion() {
    if (manualMotionOverride === "reduced") return true;
    if (manualMotionOverride === "full") return false;
    if (sceneReducedMotionSetting === "on") return true;
    if (sceneReducedMotionSetting === "off") return false;
    return systemPrefersReducedMotion();
  }

  // ---------------------------------------------------------------------
  // Demo signal controller: identical to the other two runtime builders'
  // copy.
  // ---------------------------------------------------------------------

  function createDemoController() {
    var mode = "manual"; // 'manual' | 'playback'
    var manual = { present: false, gesture: null, indexTipX: 0.5, indexTipY: 0.5, handDepth: 0, confidence: 0.9 };
    var pinching = false;
    var playbackIndex = 0;
    var listeners = [];

    function currentSignals() {
      var present = mode === "manual" ? manual.present : playbackIndex > 0 && playbackIndex <= PLAYBACK_SCRIPT.length && PLAYBACK_SCRIPT[playbackIndex - 1].present;
      var indexTipX = mode === "manual" ? manual.indexTipX : (playbackIndex > 0 ? PLAYBACK_SCRIPT[playbackIndex - 1].x : 0.5);
      var indexTipY = mode === "manual" ? manual.indexTipY : (playbackIndex > 0 ? PLAYBACK_SCRIPT[playbackIndex - 1].y : 0.5);
      var confidence = mode === "manual" ? manual.confidence : 0.95;
      var signals = {
        indexTipX: present ? indexTipX : null,
        indexTipY: present ? indexTipY : null,
        palmX: present ? 0.5 : null,
        palmY: present ? 0.5 : null,
        pinchStrength: present ? (pinching ? 1 : 0) : null,
        pinchDistance: present ? (pinching ? 0 : 1) : null,
        gestureConfidence: present && manual.gesture ? confidence : 0,
        handPresence: present,
      };
      return signals;
    }

    function emit(events) {
      listeners.forEach(function (l) { l(currentSignals(), events || []); });
    }

    function setSignal(name, value) {
      manual[name] = value;
      if (manual.present) emit([]);
    }

    function setPresent(present) {
      if (present === manual.present) return;
      manual.present = present;
      if (!present) { manual.gesture = null; pinching = false; }
      emit([present ? "event:handAppear" : "event:handDisappear"]);
    }

    function setGesture(gesture) {
      if (!manual.present) return;
      if (gesture === manual.gesture) return;
      var events = [];
      if (manual.gesture) events.push("event:gestureExit");
      manual.gesture = gesture;
      if (gesture) events.push("event:gestureEnter");
      emit(events);
    }

    function pinchStart() {
      if (!manual.present) return;
      pinching = true;
      emit(["event:pinchStart"]);
    }

    function pinchEnd() {
      if (!manual.present) return;
      pinching = false;
      emit(["event:pinchEnd"]);
    }

    function setMode(next) {
      if (next === mode) return;
      mode = next;
      emit([]);
    }

    function advancePlayback() {
      if (mode !== "playback" || playbackIndex >= PLAYBACK_SCRIPT.length) return false;
      var entry = PLAYBACK_SCRIPT[playbackIndex];
      playbackIndex += 1;
      if (entry.event === "pinchStart") pinching = true;
      if (entry.event === "pinchEnd") pinching = false;
      emit(entry.event ? ["event:" + entry.event] : []);
      return true;
    }

    function resetPlayback() {
      playbackIndex = 0;
      pinching = false;
      emit([]);
    }

    function remainingPlayback() {
      return PLAYBACK_SCRIPT.length - playbackIndex;
    }

    return {
      onFrame: function (l) { listeners.push(l); },
      getMode: function () { return mode; },
      setMode: setMode,
      setSignal: setSignal,
      setPresent: setPresent,
      setGesture: setGesture,
      pinchStart: pinchStart,
      pinchEnd: pinchEnd,
      advancePlayback: advancePlayback,
      resetPlayback: resetPlayback,
      remainingPlayback: remainingPlayback,
      totalPlayback: PLAYBACK_SCRIPT.length,
      getManualState: function () { return Object.assign({}, manual); },
      currentSignals: currentSignals,
    };
  }

  // ---------------------------------------------------------------------
  // Wiring: native <svg>, demo controls DOM, animation loop.
  // ---------------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", function () {
    var canvasHost = document.getElementById("scene-canvas-host");
    var controlsHost = document.getElementById("demo-controls-host");
    var statusEl = document.getElementById("demo-status");
    var motionToggle = document.getElementById("motion-toggle");

    var demo = createDemoController();
    var bindingsRuntime = createBindingsRuntime(SCENE);
    var pendingEvents = [];
    var startTime = null;

    demo.onFrame(function (signals, events) {
      pendingEvents = pendingEvents.concat(events);
    });

    // --- Extension point for standaloneCameraSource.ts (Task 57) --------
    // Identical contract to the other two runtime builders' copy.
    var activeInput = null;
    window.__exportSetActiveInput = function (input) {
      activeInput = input || null;
    };
    function currentInputSignals() {
      return activeInput ? activeInput.getSignals() : demo.currentSignals();
    }
    function drainInputEvents() {
      if (activeInput) return activeInput.drainEvents();
      var events = pendingEvents;
      pendingEvents = [];
      return events;
    }

    function describeSignals(signals) {
      if (!signals.handPresence) return "No hand present.";
      return (
        "Hand at (" + signals.indexTipX.toFixed(2) + ", " + signals.indexTipY.toFixed(2) + ")" +
        (signals.pinchStrength ? ", pinching" : "")
      );
    }

    function refreshStatus() {
      if (statusEl) statusEl.textContent = describeSignals(demo.currentSignals());
    }

    // --- Demo controls UI (identical to the other two runtime builders'
    // copy -- static labels only, never user-controlled content). ---
    function el(tag, props, children) {
      var e = document.createElement(tag);
      if (props) {
        Object.keys(props).forEach(function (k) {
          if (k === "text") e.textContent = props[k];
          else e.setAttribute(k, props[k]);
        });
      }
      (children || []).forEach(function (c) { e.appendChild(c); });
      return e;
    }

    if (controlsHost) {
      var modeGroup = el("div", { role: "radiogroup", "aria-label": "Demo input mode" });
      var manualBtn = el("button", { type: "button" }, []);
      manualBtn.textContent = "Manual controls";
      var playbackBtn = el("button", { type: "button" }, []);
      playbackBtn.textContent = "Synthetic playback";
      modeGroup.appendChild(manualBtn);
      modeGroup.appendChild(playbackBtn);
      controlsHost.appendChild(modeGroup);

      var manualPanel = el("div", {});
      var presentBtn = el("button", { type: "button" });
      presentBtn.textContent = "Hand present";
      manualPanel.appendChild(presentBtn);

      var sliderDefs = [
        { name: "indexTipX", label: "Index fingertip X", min: 0, max: 1, step: 0.01, value: 0.5 },
        { name: "indexTipY", label: "Index fingertip Y", min: 0, max: 1, step: 0.01, value: 0.5 },
        { name: "handDepth", label: "Hand depth (Z)", min: -0.5, max: 0.5, step: 0.01, value: 0 },
        { name: "confidence", label: "Gesture confidence", min: 0, max: 1, step: 0.01, value: 0.9 },
      ];
      sliderDefs.forEach(function (def) {
        var wrap = el("div", {});
        var label = el("label", { for: "slider-" + def.name, text: def.label });
        var input = el("input", {
          id: "slider-" + def.name,
          type: "range",
          min: String(def.min),
          max: String(def.max),
          step: String(def.step),
          value: String(def.value),
        });
        input.addEventListener("input", function () {
          demo.setSignal(def.name, Number(input.value));
          refreshStatus();
        });
        wrap.appendChild(label);
        wrap.appendChild(input);
        manualPanel.appendChild(wrap);
      });

      var gestureGroup = el("div", { role: "radiogroup", "aria-label": "Gesture state" });
      var gestureButtons = [];
      function refreshGestureChecked() {
        var current = demo.getManualState().gesture;
        gestureButtons.forEach(function (entry) {
          entry.btn.setAttribute("aria-checked", entry.value === current ? "true" : "false");
        });
      }
      [
        { value: null, label: "None" },
        { value: "openPalm", label: "Open palm" },
        { value: "closedFist", label: "Closed fist" },
        { value: "pointingUp", label: "Pointing up" },
        { value: "thumbsUp", label: "Thumbs up" },
        { value: "victory", label: "Victory" },
      ].forEach(function (option) {
        var btn = el("button", { type: "button", role: "radio", "aria-checked": "false" });
        btn.textContent = option.label;
        btn.addEventListener("click", function () {
          demo.setGesture(option.value);
          refreshGestureChecked();
          refreshStatus();
        });
        gestureButtons.push({ value: option.value, btn: btn });
        gestureGroup.appendChild(btn);
      });
      manualPanel.appendChild(gestureGroup);
      refreshGestureChecked();

      var pinchStartBtn = el("button", { type: "button", text: "Pinch start" });
      var pinchEndBtn = el("button", { type: "button", text: "Pinch end" });
      pinchStartBtn.addEventListener("click", function () { demo.pinchStart(); refreshStatus(); });
      pinchEndBtn.addEventListener("click", function () { demo.pinchEnd(); refreshStatus(); });
      manualPanel.appendChild(pinchStartBtn);
      manualPanel.appendChild(pinchEndBtn);

      presentBtn.addEventListener("click", function () {
        demo.setPresent(!demo.getManualState().present);
        refreshStatus();
      });

      var playbackPanel = el("div", { style: "display:none" });
      var playPauseBtn = el("button", { type: "button", text: "Play" });
      var stepBtn = el("button", { type: "button", text: "Step" });
      var resetBtn = el("button", { type: "button", text: "Reset" });
      var progressEl = el("p", { role: "status", "aria-live": "polite" });
      playbackPanel.appendChild(playPauseBtn);
      playbackPanel.appendChild(stepBtn);
      playbackPanel.appendChild(resetBtn);
      playbackPanel.appendChild(progressEl);

      var playbackTimer = null;
      var isPlaying = false;

      function updateProgress() {
        var played = demo.totalPlayback - demo.remainingPlayback();
        progressEl.textContent = played + " of " + demo.totalPlayback + " events played";
      }

      function stopAutoAdvance() {
        if (playbackTimer !== null) {
          window.clearInterval(playbackTimer);
          playbackTimer = null;
        }
        isPlaying = false;
        playPauseBtn.textContent = "Play";
      }

      function startAutoAdvance() {
        if (effectiveReducedMotion()) return;
        isPlaying = true;
        playPauseBtn.textContent = "Pause";
        playbackTimer = window.setInterval(function () {
          var emitted = demo.advancePlayback();
          updateProgress();
          refreshStatus();
          if (!emitted) stopAutoAdvance();
        }, 400);
      }

      playPauseBtn.addEventListener("click", function () {
        if (isPlaying) stopAutoAdvance();
        else startAutoAdvance();
      });
      stepBtn.addEventListener("click", function () {
        stopAutoAdvance();
        demo.advancePlayback();
        updateProgress();
        refreshStatus();
      });
      resetBtn.addEventListener("click", function () {
        stopAutoAdvance();
        demo.resetPlayback();
        updateProgress();
        refreshStatus();
      });

      manualBtn.addEventListener("click", function () {
        stopAutoAdvance();
        demo.setMode("manual");
        manualBtn.setAttribute("aria-checked", "true");
        playbackBtn.setAttribute("aria-checked", "false");
        manualPanel.style.display = "";
        playbackPanel.style.display = "none";
        refreshStatus();
      });
      playbackBtn.addEventListener("click", function () {
        demo.setMode("playback");
        manualBtn.setAttribute("aria-checked", "false");
        playbackBtn.setAttribute("aria-checked", "true");
        manualPanel.style.display = "none";
        playbackPanel.style.display = "";
        updateProgress();
        refreshStatus();
      });
      manualBtn.setAttribute("role", "radio");
      playbackBtn.setAttribute("role", "radio");
      manualBtn.setAttribute("aria-checked", "true");
      playbackBtn.setAttribute("aria-checked", "false");

      controlsHost.appendChild(manualPanel);
      controlsHost.appendChild(playbackPanel);
      updateProgress();
    }

    if (motionToggle) {
      motionToggle.addEventListener("change", function () {
        manualMotionOverride = motionToggle.value;
      });
    }

    refreshStatus();

    // --- Native SVG setup + draw loop ---
    if (canvasHost) {
      var canvasDef = SCENE.canvas || { width: 800, height: 600, backgroundColor: "#ffffff" };
      var svg = svgEl("svg");
      svg.setAttribute("width", String(canvasDef.width));
      svg.setAttribute("height", String(canvasDef.height));
      svg.setAttribute("viewBox", "0 0 " + canvasDef.width + " " + canvasDef.height);
      canvasHost.appendChild(svg);

      var cameraImage = null;
      if (CONFIG.cameraOverlay && CONFIG.cameraOverlay.frameDataUrl) {
        cameraImage = new Image();
        cameraImage.src = CONFIG.cameraOverlay.frameDataUrl;
      }

      var loopScheduled = false;
      function drawFrame(now) {
        loopScheduled = false;
        if (startTime === null) startTime = now;
        var timestamp = now - startTime;
        var signals = currentInputSignals();
        var events = drainInputEvents();

        var tickResult = bindingsRuntime.tick({
          timestamp: timestamp,
          signals: signals,
          events: events,
        });
        var liveScene = applyOutputsToScene(SCENE, tickResult.continuous);
        var plan = buildDrawPlan(liveScene);
        var canvasOpacity = (plan.canvas && typeof plan.canvas.opacity === "number")
          ? plan.canvas.opacity
          : 1;

        if (svg.getAttribute("width") !== String(plan.canvas.width)) svg.setAttribute("width", String(plan.canvas.width));
        if (svg.getAttribute("height") !== String(plan.canvas.height)) svg.setAttribute("height", String(plan.canvas.height));
        svg.setAttribute("viewBox", "0 0 " + plan.canvas.width + " " + plan.canvas.height);
        svg.setAttribute("opacity", String(canvasOpacity));
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        var bg = svgEl("rect");
        bg.setAttribute("x", "0");
        bg.setAttribute("y", "0");
        bg.setAttribute("width", String(plan.canvas.width));
        bg.setAttribute("height", String(plan.canvas.height));
        bg.setAttribute("fill", plan.canvas.backgroundColor);
        svg.appendChild(bg);

        if (CONFIG.cameraOverlay) {
          var behindNodes = [];
          var frontNodes = [];
          plan.nodes.forEach(function (node) {
            if (layerOrderForNode(plan, node) >= CONFIG.cameraOverlay.layerOrder) {
              frontNodes.push(node);
            } else {
              behindNodes.push(node);
            }
          });
          behindNodes.forEach(function (node) { svg.appendChild(buildNodeElement(node)); });
          var overlayEl = buildCameraOverlayElement(CONFIG.cameraOverlay, cameraImage, plan.canvas.width, plan.canvas.height);
          if (overlayEl) svg.appendChild(overlayEl);
          frontNodes.forEach(function (node) { svg.appendChild(buildNodeElement(node)); });
        } else {
          plan.nodes.forEach(function (node) { svg.appendChild(buildNodeElement(node)); });
        }

        // Reduced motion: hold the last drawn frame instead of continuing
        // to animate every frame -- see standaloneRuntimeSource.ts's
        // identical comment.
        if (!effectiveReducedMotion()) {
          loopScheduled = true;
          window.requestAnimationFrame(drawFrame);
        }
      }

      if (motionToggle) {
        motionToggle.addEventListener("change", function () {
          if (!loopScheduled && !effectiveReducedMotion()) {
            loopScheduled = true;
            window.requestAnimationFrame(drawFrame);
          }
        });
      }

      loopScheduled = true;
      window.requestAnimationFrame(drawFrame);
    }
  });
})();
`;
}
