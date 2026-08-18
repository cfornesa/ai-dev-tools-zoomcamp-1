/**
 * Task 56 (issue #57): the "compact runtime" embedded verbatim as plain
 * JavaScript inside every exported standalone HTML page.
 *
 * ## Why hand-written plain JS, not a bundled copy of the app's own TS
 *
 * `../render/sceneDrawPlan.ts` + `../render/p5Adapter.ts` (Task 25) and
 * `../runtime/behaviorRuntime.ts` (Task 35) are the app's real rendering
 * and behavior-graph engines, but neither is directly embeddable as-is:
 * they're TypeScript ES modules with `import`/`export` statements, they
 * import `p5` as an npm package (the export instead loads p5 from a CDN
 * as a global), and `behaviorRuntime.ts` alone is ~2,300 lines covering
 * far more than an exported demo needs (graph-editor-authored transform
 * chains, work-budget degradation tuned for 60Hz camera input, etc.).
 * Concatenating transpiled output from several interdependent modules
 * into one inline `<script>` with no bundler at export time is possible
 * but fragile; hand-writing a compact, self-contained equivalent scoped
 * to exactly what an export needs is more auditable and keeps the output
 * file small. That's the trade this module makes — see "Scope and
 * limitations" below for exactly what is and isn't reimplemented.
 *
 * ## Scope and limitations (documented, not accidental)
 *
 * **Rendering**: a faithful, complete port of `sceneDrawPlan.ts` +
 * `p5Adapter.ts`'s drawing logic — canvas setup, seeded randomness,
 * layer/group/shape traversal in the same draw order, all five shape
 * types, transform (translate/rotate/scale/opacity), and fill/stroke.
 * `particleEmitter` shapes render their static configured marker only
 * (position/size/first palette color) — exactly what `p5Adapter.ts`
 * itself does when no live particle snapshot is supplied — since Task 39's
 * particle *simulation* is a separate, stateful runtime input never part
 * of the scene document itself; simulating it here is out of scope for
 * this task.
 *
 * **Behavior evaluation**: this runtime evaluates `scene.bindings` only
 * (`behaviorRuntime.ts`'s "path 1" — signal -> mapping -> smoothing ->
 * clamp -> target channel), which is documented in that file's own module
 * comment as "what every behavior card actually produces and is
 * sufficient to drive the renderer end to end." `behaviorCards.ts`'s four
 * card types (Follow hand, React to pinch, Pulse, Emit particles) are the
 * only behavior-authoring UI that exists in this app today — every one of
 * them writes a `bindings` entry, so this covers every scene any user of
 * this app can currently author through the product. Hand-authored
 * `scene.graph` transform chains (oscillators, timers, math nodes wired up
 * independently of a card, via `GraphView.tsx`) are a genuine, separate
 * evaluation path (`behaviorRuntime.ts`'s "paths 2/3") that this compact
 * runtime does **not** execute — a scene relying solely on such a
 * hand-authored chain (with no card-produced binding) will render
 * statically in the export. This is a deliberate, documented V1 export
 * limitation, not a bug; a future task can extend this runtime with the
 * same transform-node evaluators `behaviorRuntime.ts` already has,
 * without changing anything else about how the export is generated.
 *
 * **Demo signals**: manual sliders + gesture/pinch buttons mirror
 * `manualProvider.ts`'s exact signal vocabulary and event semantics
 * (`indexTipX`/`indexTipY`/`handDepth`/`confidence`, hand presence,
 * gesture selection, one-shot pinch start/end — note the real app's own
 * demo controls only ever expose pinch as a discrete start/end event too,
 * never a continuous strength slider, so this matches, not simplifies,
 * today's actual `DemoControlsPanel.tsx`). The scripted playback sequence
 * below is the exact same timestamped script `demoPlaybackScript.ts`
 * produces (hand appears, moves, pinches, gestures, disappears).
 * `palmX`/`palmY` are held at the fixed neutral center (0.5, 0.5) in demo
 * mode, exactly like `manualProvider.ts`'s own fixed non-index landmark
 * positions; `pinchStrength`/`pinchDistance` are derived as a binary 1/0
 * (and its inverse) between a `pinchStart` and the next `pinchEnd`, since
 * no continuous pinch-geometry signal exists anywhere in this app's demo
 * input today either (only the discrete start/end events above).
 *
 * **No MediaPipe, no camera in this module**: this script never itself
 * references MediaPipe or `getUserMedia` — that lives entirely in the
 * separate, optional `standaloneCameraSource.ts` module (Task 57, issue
 * #56), embedded as an additional `<script>` only for camera-inclusive
 * exports. This module's only awareness of that module's existence is the
 * small extension point below (`window.__exportSetActiveInput`) — a
 * demo-only export (no camera script present) never has anything call it,
 * so its rendering/behavior is completely unchanged from a build of this
 * module before Task 57.
 */

/** The exact deterministic playback script `demoPlaybackScript.ts`
 * produces (Task 28) — a hand appears at center, moves to two positions,
 * dips in depth, pinches, returns to center, enters and exits `openPalm`,
 * then disappears. Timestamps are fixed milliseconds, matching that
 * module's own fixture. Reproduced here as inert data (never executed as
 * code) so the export needs no bundler-level import of app source. */
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

/** Returns the compact runtime as a plain-JS source string, ready to be
 * wrapped in a `<script>` tag by `generateHtmlExport.ts`. Takes no scene-
 * specific data — every export embeds the identical runtime script;
 * scene/config data is read at runtime from the `<script
 * type="application/json">` blocks `generateHtmlExport.ts` writes
 * alongside it (`scene-data`/`export-config`, see `safeEmbed.ts`). */
export function buildStandaloneRuntimeScript(): string {
  return `
(function () {
  "use strict";

  var SCENE = JSON.parse(document.getElementById("scene-data").textContent);
  var CONFIG = JSON.parse(document.getElementById("export-config").textContent);
  var PLAYBACK_SCRIPT = ${JSON.stringify(DEMO_PLAYBACK_SCRIPT)};

  // ---------------------------------------------------------------------
  // Rendering: compact port of sceneDrawPlan.ts + p5Adapter.ts. Trusts the
  // embedded scene's structure (already validated before export, and
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
      nodes: nodes,
    };
  }

  function applyTransform(sk, t) {
    sk.translate(t.x, t.y);
    sk.rotate(sk.radians(t.rotation));
    sk.scale(t.scaleX, t.scaleY);
  }

  function applyFillAndStroke(sk, shape, opacity) {
    var style = shape.style;
    if (style.fill === null) {
      sk.noFill();
    } else {
      var fc = parseColor(style.fill);
      sk.fill(fc.r, fc.g, fc.b, fc.a * opacity * 255);
    }
    if (style.stroke === null) {
      sk.noStroke();
    } else {
      var sc = parseColor(style.stroke);
      sk.stroke(sc.r, sc.g, sc.b, sc.a * opacity * 255);
    }
    sk.strokeWeight(style.strokeWidth);
  }

  function drawShapeGeometry(sk, shape) {
    switch (shape.type) {
      case "circle":
        sk.circle(0, 0, shape.radius * 2);
        return;
      case "rect":
        sk.rect(0, 0, shape.width, shape.height, shape.cornerRadius);
        return;
      case "line":
        sk.line(0, 0, shape.x2 - shape.transform.x, shape.y2 - shape.transform.y);
        return;
      case "path":
        sk.beginShape();
        (shape.points || []).forEach(function (p) { sk.vertex(p.x, p.y); });
        if (shape.closed) sk.endShape(sk.CLOSE);
        else sk.endShape();
        return;
      case "particleEmitter":
        if (shape.palette && shape.palette.length > 0) {
          var c = parseColor(shape.palette[0]);
          sk.fill(c.r, c.g, c.b);
        }
        sk.circle(0, 0, shape.size);
        return;
      default:
        return;
    }
  }

  function drawNode(sk, node, inheritedOpacity) {
    if (node.kind === "shape") {
      var opacity = inheritedOpacity * node.shape.transform.opacity;
      sk.push();
      applyTransform(sk, node.shape.transform);
      applyFillAndStroke(sk, node.shape, opacity);
      drawShapeGeometry(sk, node.shape);
      sk.pop();
      return;
    }
    if (!node.group.visible) return;
    var gOpacity = inheritedOpacity * node.group.transform.opacity;
    sk.push();
    applyTransform(sk, node.group.transform);
    node.children.forEach(function (child) { drawNode(sk, child, gOpacity); });
    sk.pop();
  }

  // ---------------------------------------------------------------------
  // Bindings runtime: compact port of behaviorRuntime.ts's "path 1"
  // (scene.bindings) evaluation -- see the module doc comment for scope.
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
  // Reduced motion: mirrors a11y/reducedMotion.ts's decision rule. The
  // scene's own authored accessibility.reducedMotion ("auto"/"on"/"off")
  // is the export's baseline; a visible manual toggle can still override
  // it for this viewing session (not persisted -- there is no localStorage
  // namespace shared with the editor app for a standalone file opened from
  // disk).
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
  // Demo signal controller: mirrors manualProvider.ts + demoController.ts.
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
        // palmX/Y held at the fixed neutral center in demo mode -- see the
        // module doc comment.
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
  // Wiring: p5 instance, demo controls DOM, animation loop.
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
    var sk = null;

    demo.onFrame(function (signals, events) {
      pendingEvents = pendingEvents.concat(events);
    });

    // --- Extension point for standaloneCameraSource.ts (Task 57) --------
    // When present and the camera is active, that module calls this with
    // an { getSignals, drainEvents } handle so the draw loop below reads
    // live camera-derived signals instead of the demo controller's; it
    // calls this with null on stop/error to revert to demo signals. A
    // demo-only export never has anything call this function.
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

    // --- Demo controls UI (static labels only -- never user-controlled
    // content, so building via createElement/textContent here is safe by
    // construction; scene data never reaches this function). ---
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
      [
        { value: null, label: "None" },
        { value: "openPalm", label: "Open palm" },
        { value: "closedFist", label: "Closed fist" },
        { value: "pointingUp", label: "Pointing up" },
        { value: "thumbsUp", label: "Thumbs up" },
        { value: "victory", label: "Victory" },
      ].forEach(function (option) {
        var btn = el("button", { type: "button" });
        btn.textContent = option.label;
        btn.addEventListener("click", function () {
          demo.setGesture(option.value);
          refreshStatus();
        });
        gestureGroup.appendChild(btn);
      });
      manualPanel.appendChild(gestureGroup);

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
        if (effectiveReducedMotion()) return; // reduced motion: stepped only
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
        if (effectiveReducedMotion()) stopAutoAdvanceIfRunning();
      });
    }
    function stopAutoAdvanceIfRunning() {
      var evt = new Event("reducedmotionchange");
      document.dispatchEvent(evt);
    }

    refreshStatus();

    // --- p5 sketch ---
    if (canvasHost && window.p5) {
      new window.p5(function (p) {
        p.setup = function () {
          var canvasDef = SCENE.canvas || { width: 800, height: 600, backgroundColor: "#ffffff" };
          var c = p.createCanvas(canvasDef.width, canvasDef.height);
          c.parent(canvasHost);
          p.pixelDensity(1);
          p.noSmooth();
          p.frameRate(30);
        };
        p.draw = function () {
          if (startTime === null) startTime = p.millis();
          var timestamp = p.millis() - startTime;
          var signals = currentInputSignals();
          var events = drainInputEvents();

          var tickResult = bindingsRuntime.tick({
            timestamp: timestamp,
            signals: signals,
            events: events,
          });
          var liveScene = applyOutputsToScene(SCENE, tickResult.continuous);
          var plan = buildDrawPlan(liveScene);

          p.push();
          if (plan.randomness && plan.randomness.enabled) {
            p.randomSeed(plan.randomness.seed);
            p.noiseSeed(plan.randomness.seed);
          }
          p.background(plan.canvas.backgroundColor);
          plan.nodes.forEach(function (node) { drawNode(p, node, 1); });
          p.pop();

          // Reduced motion: hold the last drawn frame instead of
          // continuing to animate every frame (a static render still
          // reflects the latest demo-control state, so nothing about the
          // scene becomes inaccessible -- only continuous, non-essential
          // motion between explicit control changes is suppressed).
          if (effectiveReducedMotion()) p.noLoop();
          else if (!p.isLooping()) p.loop();
        };
      });
    }
  });
})();
`;
}
