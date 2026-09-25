/**
 * Issue #436: the downloadable Full ZIP's `index.html` used to dispatch
 * unconsumed `art-piece-command` CustomEvents for sound/camera/hand
 * actions -- nothing in the exported bundle ever listened for them or
 * performed the actual `AudioContext`/`getUserMedia`/camera-pose work
 * `artPieceSandbox.ts`'s live-preview runtime already implements for
 * #430-#434. This module is that same real runtime, ported to a
 * standalone (no parent window, no postMessage) context: buttons call
 * the underlying functions directly and update their own label/pressed
 * state/status text synchronously from the real outcome, instead of
 * round-tripping through a message bus that doesn't exist once the
 * piece is downloaded and opened from disk.
 *
 * Kept as its own hand-synced copy of the sandbox's runtime behavior
 * (not a shared import of executable code -- there is no way to import
 * a `<script>` tag's textual contents across a build boundary), the
 * same way `artPieceSandbox.ts`'s own doc comment already documents for
 * `art_piece_provider.py`'s backend constants vs. its own frontend
 * constants. Any future change to the sandbox's runtime *behavior*
 * (not just its CDN URLs) should be mirrored here.
 */
import type { ArtPieceCapabilitySet, ArtPieceLibrary, CameraPlacement } from '../api/artPieces';
import type { ArtPieceExportMode, ArtPieceExportPresentation } from '../generative/artPieceBundle';

const SPATIAL_LIBRARIES: ArtPieceLibrary[] = [
  'canvas2d',
  'svg',
  'p5js',
  'c2js',
  'c2js-interactive',
  'threejs',
  'aframe',
];
const NATIVE_SPATIAL_LIBRARIES: ArtPieceLibrary[] = ['threejs', 'aframe'];

/** Small, discrete per-keypress/per-drag-step deltas -- kept identical to
 * `ImmersiveArtPieceViewer.tsx`'s own `KEY_STEP`/`DRAG_SENSITIVITY`/
 * `ZOOM_STEP` constants, ported here the same hand-synced way the rest
 * of this module already mirrors the live preview's runtime. */
const NAV_KEY_STEP = 0.3;
const NAV_DRAG_SENSITIVITY = 0.02;
const NAV_ZOOM_STEP = 0.5;

export function buildStandaloneArtPieceRuntimeScript(
  library: ArtPieceLibrary,
  capabilities: ArtPieceCapabilitySet,
  mode: ArtPieceExportMode,
  presentation: ArtPieceExportPresentation = 'regular',
  cameraPlacement: CameraPlacement = 'overlay',
): string {
  const includeSound = capabilities.sound === true;
  const includeKeyboard = capabilities.keyboard === true;
  const includeMicrophone = capabilities.microphone === true;
  // Non-Camera ZIP (#437) owns device-isolation verification; this
  // module still respects capabilities/mode so #436's own Full ZIP
  // fixture (camera+steering enabled) has real code to exercise, and so
  // a non-camera export never even defines a getUserMedia call path.
  const includeCamera = mode === 'full' && capabilities.camera_view === true;
  // Issue #459: a flat (Canvas2D/SVG) piece gets the same lazily-built
  // CSS 3D shell `artPieceSandbox.ts`'s live preview already implements
  // for #449 -- no engine restriction here anymore, only the mode/
  // capability gate every other control shares.
  const includeSteering = mode === 'full' && capabilities.hand_steering === true;
  const isSpatialLibrary = NATIVE_SPATIAL_LIBRARIES.includes(library);
  const includeFullscreen = capabilities.fullscreen !== false;
  const includeScreenshot = capabilities.screenshot !== false;
  // Issue #448: the Guide dialog is static, capability-independent
  // content (the same "Look around with an open hand..." steps the live
  // preview always offers regardless of which capabilities are on) --
  // unconditional, matching `PieceStageControls.tsx`'s own always-present
  // "Show hand gesture guide" button.
  const includeGuide = true;
  // Walkable navigation uses native cameras for Three.js/A-Frame and the
  // lazy synthetic room shell for flat engines.
  const includeNavigation = presentation === 'immersive' && SPATIAL_LIBRARIES.includes(library);

  return `<script>
(function () {
  var pieceLibrary = ${JSON.stringify(library)};
  var runtimeFailed = false;
  var runtimeReady = false;
  function reportRuntimeError(message) {
    runtimeFailed = true;
    var el = document.getElementById('art-piece-runtime-error');
    if (el) { el.textContent = message; el.hidden = false; }
  }
  window.addEventListener('error', function (event) {
    reportRuntimeError((event && event.message) || 'The generated piece threw an error.');
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    reportRuntimeError((reason && reason.message) || String(reason) || 'An unhandled promise rejection occurred.');
  });
  setTimeout(function () {
    if (!runtimeReady && !runtimeFailed) reportRuntimeError('The interactive runtime could not be started.');
  }, 10000);
  // window.__registerArtPieceCamera must exist before scripts/piece.js
  // runs (Three.js calls it as soon as its own script executes), so this
  // part -- unlike everything else below, which touches DOM elements
  // this script's own <head> placement means don't exist yet -- runs
  // immediately at the top level, not deferred to DOMContentLoaded.
  var registeredCamera = null;
  var initialCameraPose = null;
  window.__registerArtPieceCamera = function (adapter) {
    registeredCamera = adapter;
    try { initialCameraPose = adapter.getPose(); } catch (e) { initialCameraPose = null; }
  };
  ${
    !isSpatialLibrary
      ? `
  // Flat engines use the same lazy synthetic room shell as the live
  // sandbox. It is defined before controls so immersive navigation can
  // activate it even when hand steering is not enabled.
  var flatShellArtwork = null;
  var flatShellOriginalStyle = null;
  var flatShellPose = { x: 0, y: 0, z: 5 };
  function applyFlatShellPose(x, y, z) {
    if (!flatShellArtwork) return;
    var rotateY = x * 15;
    var rotateX = -y * 15;
    var zoom = 5 / z;
    flatShellArtwork.style.transform =
      'rotateY(' + rotateY + 'deg) rotateX(' + rotateX + 'deg) scale(' + zoom + ')';
  }
  function ensureFlatSpatialShell() {
    if (registeredCamera) return true;
    var artwork = document.querySelector('canvas') || document.querySelector('svg:not(.piece-stage-icon)');
    if (!artwork) return false;
    flatShellArtwork = artwork;
    flatShellOriginalStyle = artwork.getAttribute('style');
    document.body.style.perspective = '800px';
    artwork.style.transformOrigin = 'center center';
    artwork.style.transition = 'none';
    flatShellPose = { x: 0, y: 0, z: 5 };
    applyFlatShellPose(0, 0, 5);
    window.__registerArtPieceCamera({
      getPose: function () { return flatShellPose; },
      setPose: function (x, y, z) {
        flatShellPose = { x: x, y: y, z: z };
        applyFlatShellPose(x, y, z);
      }
    });
    return true;
  }
  function disposeFlatSpatialShell() {
    if (flatShellArtwork) {
      if (flatShellOriginalStyle === null) flatShellArtwork.removeAttribute('style');
      else flatShellArtwork.setAttribute('style', flatShellOriginalStyle);
    }
    flatShellArtwork = null;
    registeredCamera = null;
    initialCameraPose = null;
  }
  `
      : ''
  }

  function setupControls() {
  function byAction(action) { return document.querySelector('[data-action="' + action + '"]'); }
  // Icon buttons (#755) carry an aria-label plus a tooltip span instead of visible text; text
  // buttons (mic/camera/steer inside Piece controls) still show their label.
  function setLabel(button, label) {
    button.setAttribute('aria-label', label);
    var tip = button.querySelector('.piece-stage-tooltip');
    if (tip) tip.textContent = label; else button.textContent = label;
  }
  function setStatus(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function reportError(message) {
    runtimeFailed = true;
    var el = document.getElementById('art-piece-runtime-error');
    if (el) { el.textContent = message; el.hidden = false; }
  }
  window.addEventListener('error', function (event) {
    reportError((event && event.message) || 'The generated piece threw an error.');
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    reportError((reason && reason.message) || String(reason) || 'An unhandled promise rejection occurred.');
  });

  // Reset: resets the registered spatial camera (if any) to the pose it
  // had when registered, without touching sound/camera/steering state --
  // always also dispatches the pre-existing art-piece-command event for
  // any piece that handles its own reset independently of this hook.
  var resetButton = byAction('reset');
  if (resetButton) {
    resetButton.addEventListener('click', function () {
      if (registeredCamera && initialCameraPose) {
        if (registeredCamera.reset) registeredCamera.reset();
        else registeredCamera.setPose(initialCameraPose.x, initialCameraPose.y, initialCameraPose.z);
      }
      if (typeof reportNavPose === 'function') reportNavPose();
      // Issue #459: "reset while steering on" only re-homes the shell
      // (already done above via registeredCamera.setPose); "reset while
      // steering off" tears it down -- same rule #449 established for the
      // live preview. Guarded with typeof since these only exist when
      // hand_steering is enabled for this export at all.
      if (
        typeof steeringActive !== 'undefined' &&
        !steeringActive &&
        typeof flatShellArtwork !== 'undefined' &&
        flatShellArtwork &&
        typeof disposeFlatSpatialShell === 'function'
      ) {
        disposeFlatSpatialShell();
      }
      window.dispatchEvent(new CustomEvent('art-piece-command', { detail: { type: 'reset-view', version: 1 } }));
    });
  }

  ${
    includeGuide
      ? `
  var guideButton = byAction('guide');
  var guideDialog = document.getElementById('art-piece-guide-dialog');
  var guideCloseButton = byAction('guide-close');
  if (guideButton && guideDialog) {
    guideButton.addEventListener('click', function () { guideDialog.hidden = false; });
  }
  if (guideCloseButton && guideDialog) {
    guideCloseButton.addEventListener('click', function () { guideDialog.hidden = true; });
  }
  `
      : ''
  }

  // Piece controls popover (#755): opens the mic/camera/steer rows; Escape closes it (or the
  // guide dialog first) and returns focus to its trigger.
  var controlsToggle = byAction('controls');
  var controlsPanel = document.getElementById('art-piece-controls-panel');
  if (controlsToggle && controlsPanel) {
    controlsToggle.addEventListener('click', function () {
      controlsPanel.hidden = !controlsPanel.hidden;
      controlsToggle.setAttribute('aria-expanded', String(!controlsPanel.hidden));
    });
  }
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var dialog = document.getElementById('art-piece-guide-dialog');
    var dialogTrigger = byAction('guide');
    if (dialog && !dialog.hidden) {
      dialog.hidden = true;
      if (dialogTrigger) dialogTrigger.focus();
    } else if (controlsPanel && !controlsPanel.hidden) {
      controlsPanel.hidden = true;
      if (controlsToggle) { controlsToggle.setAttribute('aria-expanded', 'false'); controlsToggle.focus(); }
    }
  });

  ${
    includeNavigation
      ? `
  // Walkable navigation: arrow-key travel, drag look, wheel zoom -- the
  // exact same delta math and gesture mapping as
  // ImmersiveArtPieceViewer.tsx's own navigate()/onKeyDown/onPointerMove/
  // onWheel, applied directly to the registered camera adapter instead
  // of round-tripping through postMessage (there is no parent window in
  // a standalone export).
  var navPoseEl = document.getElementById('art-piece-navigation-pose');
  var navDragStart = null;
  function reportNavPose() {
    if (!navPoseEl) return;
    if (!registeredCamera) {
      navPoseEl.textContent = '0.00,0.00,5.00';
      return;
    }
    var pose = registeredCamera.getPose();
    navPoseEl.textContent = pose.x.toFixed(2) + ',' + pose.y.toFixed(2) + ',' + pose.z.toFixed(2);
  }
  ${
    library === 'aframe'
      ? `
  // A-Frame declarative pieces have no generated script that can register
  // their camera. Mirror the live sandbox's trusted adapter so the
  // standalone immersive export exposes the same navigation contract.
  var aframeScene = document.querySelector('a-scene');
  function registerAframeCamera() {
    if (!aframeScene || registeredCamera || !aframeScene.camera) return;
    var cameraObject = aframeScene.camera;
    if (!cameraObject.el || !cameraObject.el.object3D) return;
    var cameraElement = cameraObject.el;
    var wrappingElement = cameraElement.parentEl;
    var placedObject = wrappingElement && wrappingElement.tagName !== 'A-SCENE'
      ? wrappingElement.object3D
      : cameraElement.object3D;
    window.__registerArtPieceCamera({
      getPose: function () {
        return { x: placedObject.position.x, y: placedObject.position.y, z: placedObject.position.z };
      },
      setPose: function (x, y, z) {
        placedObject.position.set(x, y, z);
        placedObject.lookAt(0, 0, 0);
      }
    });
    reportNavPose();
  }
  if (aframeScene) {
    if (aframeScene.hasLoaded) registerAframeCamera();
    else aframeScene.addEventListener('loaded', registerAframeCamera);
  }
  `
      : ''
  }
  function navigateBy(dx, dz) {
    if (!registeredCamera && typeof ensureFlatSpatialShell === 'function') ensureFlatSpatialShell();
    if (!registeredCamera) return;
    var pose = registeredCamera.getPose();
    registeredCamera.setPose(pose.x + (dx || 0), pose.y, pose.z + (dz || 0));
    reportNavPose();
  }
  var navStage = document.getElementById('art-piece-container') || document.body;
  navStage.tabIndex = navStage.tabIndex || 0;
  navStage.setAttribute('aria-label', 'Immersive stage');
  navStage.addEventListener('keydown', function (event) {
    var step = ${NAV_KEY_STEP};
    if (event.key === 'ArrowUp') navigateBy(0, -step);
    else if (event.key === 'ArrowDown') navigateBy(0, step);
    else if (event.key === 'ArrowLeft') navigateBy(-step, 0);
    else if (event.key === 'ArrowRight') navigateBy(step, 0);
    else return;
    event.preventDefault();
  });
  navStage.addEventListener('pointerdown', function (event) {
    navDragStart = { x: event.clientX, y: event.clientY };
  });
  window.addEventListener('pointermove', function (event) {
    if (!navDragStart) return;
    var dx = (event.clientX - navDragStart.x) * ${NAV_DRAG_SENSITIVITY};
    var dy = (event.clientY - navDragStart.y) * ${NAV_DRAG_SENSITIVITY};
    navDragStart = { x: event.clientX, y: event.clientY };
    navigateBy(dx, dy);
  });
  window.addEventListener('pointerup', function () { navDragStart = null; });
  navStage.addEventListener('wheel', function (event) {
    event.preventDefault();
    navigateBy(0, event.deltaY > 0 ? ${NAV_ZOOM_STEP} : -${NAV_ZOOM_STEP});
  }, { passive: false });
  if (typeof ensureFlatSpatialShell === 'function') ensureFlatSpatialShell();
  reportNavPose();
  `
      : ''
  }

  ${
    includeScreenshot
      ? `
  // Screenshot: same camera-compositing behavior as the live preview --
  // the camera overlay (if active) is drawn on top of the artwork in
  // the same stacking order it renders live, at its current opacity.
  function compositeScreenshot(baseCanvas) {
    var video = document.getElementById('art-piece-camera-overlay');
    var extras = window.__artPieceScreenshotExtras || [];
    var hasVideo = !!(video && video.videoWidth);
    if (!hasVideo && !extras.length) return baseCanvas.toDataURL('image/png');
    var composite = document.createElement('canvas');
    composite.width = baseCanvas.width;
    composite.height = baseCanvas.height;
    var ctx = composite.getContext('2d');
    ctx.drawImage(baseCanvas, 0, 0);
    // Extras (e.g. the visitor drawing marks, #757) sit above the artwork, below the camera overlay.
    extras.forEach(function (draw) { draw(ctx, composite.width, composite.height); });
    if (hasVideo) {
      ctx.save();
      ctx.globalAlpha = cameraOpacity;
      ctx.drawImage(video, 0, 0, composite.width, composite.height);
      ctx.restore();
    }
    return composite.toDataURL('image/png');
  }
  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
  var screenshotButton = byAction('screenshot');
  if (screenshotButton) {
    screenshotButton.addEventListener('click', function () {
      var filename = 'art-piece-screenshot-' + Date.now() + '.png';
      var canvas = document.querySelector('canvas');
      try {
        if (canvas && canvas.toBlob) {
          var dataUrl = compositeScreenshot(canvas);
          fetch(dataUrl).then(function (r) { return r.blob(); }).then(function (blob) { saveBlob(blob, filename); });
        } else {
          var svg = document.querySelector('svg:not(.piece-stage-icon)');
          if (!svg) throw new Error('This piece has no capturable artwork.');
          var svgText = new XMLSerializer().serializeToString(svg);
          // #794: an inked SVG piece keeps its ink in the saved file (as a scaled group over the artwork).
          if (window.__artPieceInkSvg) {
            var box = svg.viewBox && svg.viewBox.baseVal;
            var inkW = (box && box.width) || svg.getBoundingClientRect().width || 300;
            var inkH = (box && box.height) || svg.getBoundingClientRect().height || 150;
            var closeAt = svgText.lastIndexOf('</svg>');
            if (closeAt >= 0) {
              svgText = svgText.slice(0, closeAt) + window.__artPieceInkSvg(inkW, inkH) + svgText.slice(closeAt);
            }
          }
          saveBlob(new Blob([svgText], { type: 'image/svg+xml' }), filename.replace('.png', '.svg'));
        }
      } catch (e) {
        reportError(e && e.message ? e.message : 'Screenshot failed.');
      }
    });
  }
  `
      : ''
  }

  ${
    includeSound
      ? `
  // Sound: only ever starts from this explicit button, never on load.
  var audioCtx = null;
  var masterGain = null;
  var masterFilter = null;
  var ambientBpm = 90;
  var ambientVolume = 0.5;
  var ambientMuted = false;
  var ambientScale = 'pentatonic';
  var melodicVolume = 0.5;
  var melodicMuted = false;
  var keyboardEnabled = false;
  var melodicOscillator = 'sine';
  var melodicOctave = 0;
  var melodicEnvelope = { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 };
  var voiceGains = { ambient: null, melodic: null };
  var ambientTimer = null;
  var ambientIndex = 0;
  var ambientNotes = [130.81, 146.83, 164.81, 196, 220, 261.63];
  var soundOn = false;
  var soundButton = byAction('sound');
  function ensureAudio() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.2;
      masterFilter = audioCtx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 2000;
      masterFilter.Q.value = 1;
      voiceGains.ambient = audioCtx.createGain();
      voiceGains.melodic = audioCtx.createGain();
      voiceGains.ambient.gain.value = ambientVolume;
      voiceGains.melodic.gain.value = melodicVolume;
      voiceGains.ambient.connect(masterGain);
      voiceGains.melodic.connect(masterGain);
      masterGain.connect(masterFilter);
      masterFilter.connect(audioCtx.destination);
    }
    return audioCtx;
  }
  function stopAmbient() {
    if (ambientTimer !== null) { clearInterval(ambientTimer); ambientTimer = null; }
  }
  function startAmbient() {
    stopAmbient();
    ambientTimer = setInterval(function () {
      if (!soundOn || ambientMuted || !audioCtx) return;
      var oscillator = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = ambientNotes[ambientIndex % ambientNotes.length];
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(voiceGains.ambient || masterGain);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.35);
      ambientIndex += 1;
    }, 60000 / ambientBpm);
  }
  if (soundButton) {
    soundButton.addEventListener('click', function () {
      ensureAudio();
      soundOn = !soundOn;
      if (soundOn) { audioCtx.resume(); startAmbient(); } else { audioCtx.suspend(); stopAmbient(); keyboardEnabled = false; }
      soundButton.setAttribute('aria-pressed', String(soundOn));
      setLabel(soundButton, soundOn ? 'Mute sound' : 'Unmute sound');
      setStatus('art-piece-sound-status', soundOn ? 'Sound is on.' : 'Sound is off.');
    });
  }
  function bindRange(id, callback) {
    var element = document.getElementById(id);
    if (element) element.addEventListener('input', function (event) { callback(Number(event.target.value)); });
  }
  bindRange('art-piece-ambient-bpm', function (value) { ambientBpm = Math.max(40, Math.min(220, value)); document.getElementById('art-piece-ambient-bpm-value').textContent = String(ambientBpm); if (soundOn) startAmbient(); });
  bindRange('art-piece-ambient-volume', function (value) { ambientVolume = Math.max(0, Math.min(100, value)) / 100; document.getElementById('art-piece-ambient-volume-value').textContent = String(value) + '%'; if (voiceGains.ambient) voiceGains.ambient.gain.value = ambientVolume; });
  document.getElementById('art-piece-ambient-muted')?.addEventListener('change', function (event) { ambientMuted = event.target.checked; });
  document.getElementById('art-piece-ambient-scale')?.addEventListener('change', function (event) { ambientScale = event.target.value; });
  bindRange('art-piece-keyboard-volume', function (value) { melodicVolume = Math.max(0, Math.min(100, value)) / 100; document.getElementById('art-piece-keyboard-volume-value').textContent = String(value) + '%'; if (voiceGains.melodic) voiceGains.melodic.gain.value = melodicVolume; });
  document.getElementById('art-piece-keyboard-oscillator')?.addEventListener('change', function (event) { melodicOscillator = event.target.value; });
  document.getElementById('art-piece-keyboard-filter-type')?.addEventListener('change', function (event) { if (masterFilter) masterFilter.type = event.target.value; });
  bindRange('art-piece-keyboard-filter-cutoff', function (value) { if (masterFilter) masterFilter.frequency.value = Math.max(20, Math.min(20000, value)); });
  bindRange('art-piece-keyboard-filter-resonance', function (value) { if (masterFilter) masterFilter.Q.value = Math.max(0.1, Math.min(20, value)); });
  ['attack', 'decay', 'sustain', 'release'].forEach(function (field) { bindRange('art-piece-keyboard-' + field, function (value) { melodicEnvelope[field] = value; }); });
  bindRange('art-piece-keyboard-octave', function (value) { melodicOctave = Math.max(-2, Math.min(2, Math.round(value))); document.getElementById('art-piece-keyboard-octave-value').textContent = String(melodicOctave); });
  document.getElementById('art-piece-keyboard')?.addEventListener('click', function (event) {
    keyboardEnabled = !keyboardEnabled;
    event.currentTarget.setAttribute('aria-pressed', String(keyboardEnabled));
    event.currentTarget.textContent = keyboardEnabled ? 'Stop keyboard notes' : 'Keyboard notes';
  });
  ${
    includeKeyboard
      ? `
  var NOTE_FREQUENCIES = { a: 220.0, s: 246.94, d: 261.63, f: 293.66, g: 329.63, h: 349.23, j: 392.0, k: 440.0 };
  window.addEventListener('keydown', function (event) {
    if (!soundOn || !keyboardEnabled || melodicMuted || !audioCtx) return;
    var frequency = NOTE_FREQUENCIES[(event.key || '').toLowerCase()];
    if (!frequency) return;
    var oscillator = audioCtx.createOscillator();
    oscillator.type = melodicOscillator;
    oscillator.frequency.value = frequency * Math.pow(2, melodicOctave);
    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.16, audioCtx.currentTime + melodicEnvelope.attack);
    gain.gain.linearRampToValueAtTime(0.16 * melodicEnvelope.sustain, audioCtx.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(voiceGains.melodic || masterGain);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
  });
  `
      : ''
  }
  `
      : ''
  }

  ${
    includeMicrophone
      ? `
  // Microphone: its own gesture, entirely independent of Camera view.
  var micStream = null;
  var micButton = byAction('microphone');
  if (micButton) {
    micButton.addEventListener('click', function () {
      if (micStream) {
        micStream.getTracks().forEach(function (t) { t.stop(); });
        micStream = null;
        micButton.setAttribute('aria-pressed', 'false');
        micButton.textContent = 'Enable microphone';
        setStatus('art-piece-microphone-status', 'Microphone is off.');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('art-piece-microphone-status', 'Microphone is unavailable in this browser.');
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
        micStream = stream;
        micButton.setAttribute('aria-pressed', 'true');
        micButton.textContent = 'Disable microphone';
        setStatus('art-piece-microphone-status', 'Microphone is active.');
      }).catch(function () {
        setStatus('art-piece-microphone-status', 'Microphone access was denied.');
      });
    });
  }
  `
      : ''
  }

  ${
    includeCamera
      ? `
  // Camera view: a real <video> overlay, pointer-events: none so it
  // never intercepts input, composited into Screenshot above.
  var cameraStream = null;
  var cameraOpacity = 0.5;
  var cameraButton = byAction('camera');
  function getCameraOverlay() {
    var video = document.getElementById('art-piece-camera-overlay');
    if (!video) {
      video = document.createElement('video');
      video.id = 'art-piece-camera-overlay';
      video.autoplay = true; video.muted = true; video.playsInline = true;
      video.style.position = 'fixed'; video.style.inset = '0';
      video.style.width = '100%'; video.style.height = '100%';
      video.style.objectFit = 'cover'; video.style.pointerEvents = 'none';
      video.style.zIndex = ${cameraPlacement === 'background' ? '0' : '2'};
      video.style.opacity = String(cameraOpacity);
      document.body.appendChild(video);
    }
    return video;
  }
  function stopCamera() {
    if (cameraStream) { cameraStream.getTracks().forEach(function (t) { t.stop(); }); cameraStream = null; }
    var video = document.getElementById('art-piece-camera-overlay');
    if (video) video.remove();
  }
  if (cameraButton) {
    cameraButton.addEventListener('click', function () {
      if (cameraStream) {
        stopCamera();
        cameraButton.setAttribute('aria-pressed', 'false');
        cameraButton.textContent = 'Enable camera view';
        setStatus('art-piece-camera-status', 'Camera is off.');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('art-piece-camera-status', 'Camera is unavailable in this browser.');
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(function (stream) {
        cameraStream = stream;
        var overlay = getCameraOverlay();
        overlay.srcObject = stream;
        var track = stream.getVideoTracks()[0];
        if (track) {
          track.addEventListener('ended', function () {
            stopCamera();
            cameraButton.setAttribute('aria-pressed', 'false');
            cameraButton.textContent = 'Enable camera view';
            setStatus('art-piece-camera-status', 'Camera stream ended unexpectedly.');
          });
        }
        cameraButton.setAttribute('aria-pressed', 'true');
        cameraButton.textContent = 'Disable camera view';
        setStatus('art-piece-camera-status', 'Camera is active.');
      }).catch(function () {
        setStatus('art-piece-camera-status', 'Camera access was denied.');
      });
    });
  }
  `
      : ''
  }

  ${
    includeSteering
      ? `
  // Hand steering: gated on Camera view already being active and a
  // registered spatial camera, exactly like the live preview. Real
  // hand-landmark detection is a separately tracked follow-up (#455) --
  // this is the same scoped, testable lifecycle, standing in for it.
  var steeringActive = false;
  var STEER_MIN_RADIUS = 1.5, STEER_MAX_RADIUS = 20;
  function clampSteerPose(pose) {
    var radius = Math.sqrt(pose.x * pose.x + pose.y * pose.y + pose.z * pose.z);
    if (radius === 0) return pose;
    var clamped = Math.max(STEER_MIN_RADIUS, Math.min(STEER_MAX_RADIUS, radius));
    var scale = clamped / radius;
    return { x: pose.x * scale, y: pose.y * scale, z: pose.z * scale };
  }
  ${
    isSpatialLibrary || includeNavigation
      ? ''
      : `
  // Issue #459: a Canvas2D/SVG export has no native spatial camera to
  // register the way a Three.js/A-Frame snippet does -- lazily build a
  // CSS 3D presentation of the existing, unmodified canvas/svg element
  // (never touching its own drawing code) and register a synthetic
  // camera adapter through the same window.__registerArtPieceCamera
  // hook, so the shared clampSteerPose/__steerArtPiece/reset logic below
  // drives it identically to a real spatial camera. Ported verbatim from
  // artPieceSandbox.ts's own ensureFlatSpatialShell (#449).
  var flatShellArtwork = null;
  var flatShellOriginalStyle = null;
  var flatShellPose = { x: 0, y: 0, z: 5 };
  function applyFlatShellPose(x, y, z) {
    if (!flatShellArtwork) return;
    var rotateY = x * 15;
    var rotateX = -y * 15;
    var zoom = 5 / z;
    flatShellArtwork.style.transform =
      'rotateY(' + rotateY + 'deg) rotateX(' + rotateX + 'deg) scale(' + zoom + ')';
  }
  function ensureFlatSpatialShell() {
    if (registeredCamera) return true;
    var artwork = document.querySelector('canvas') || document.querySelector('svg:not(.piece-stage-icon)');
    if (!artwork) return false;
    flatShellArtwork = artwork;
    flatShellOriginalStyle = artwork.getAttribute('style');
    document.body.style.perspective = '800px';
    artwork.style.transformOrigin = 'center center';
    artwork.style.transition = 'none';
    flatShellPose = { x: 0, y: 0, z: 5 };
    applyFlatShellPose(0, 0, 5);
    window.__registerArtPieceCamera({
      getPose: function () { return flatShellPose; },
      setPose: function (x, y, z) {
        flatShellPose = { x: x, y: y, z: z };
        applyFlatShellPose(x, y, z);
      }
    });
    return true;
  }
  function disposeFlatSpatialShell() {
    if (flatShellArtwork) {
      if (flatShellOriginalStyle === null) flatShellArtwork.removeAttribute('style');
      else flatShellArtwork.setAttribute('style', flatShellOriginalStyle);
    }
    flatShellArtwork = null;
    registeredCamera = null;
    initialCameraPose = null;
  }
  `
  }
  var steerButton = byAction('hand');
  if (steerButton) {
    steerButton.addEventListener('click', function () {
      if (steeringActive) {
        steeringActive = false;
        ${isSpatialLibrary ? '' : "if (flatShellArtwork) flatShellArtwork.style.pointerEvents = 'auto';"}
        steerButton.setAttribute('aria-pressed', 'false');
        steerButton.textContent = 'Steer the piece';
        setStatus('art-piece-steering-status', 'Steering is off.');
        return;
      }
      if (typeof cameraStream === 'undefined' || !cameraStream) {
        setStatus('art-piece-steering-status', 'Turn on Camera view before steering.');
        return;
      }
      ${
        isSpatialLibrary
          ? `
      if (!registeredCamera) {
        setStatus('art-piece-steering-status', "This piece hasn't set up a walkable camera yet.");
        return;
      }
      `
          : `
      if (!ensureFlatSpatialShell()) {
        setStatus('art-piece-steering-status', "This piece hasn't set up a walkable camera yet.");
        return;
      }
      flatShellArtwork.style.pointerEvents = 'none';
      `
      }
      steeringActive = true;
      steerButton.setAttribute('aria-pressed', 'true');
      steerButton.textContent = 'Stop steering';
      setStatus('art-piece-steering-status', 'Steering is active.');
    });
  }
  window.__steerArtPiece = function (dx, dy, dz) {
    if (!steeringActive || !registeredCamera) return;
    var pose = registeredCamera.getPose();
    var next = clampSteerPose({
      x: pose.x + (dx || 0), y: pose.y + (dy || 0), z: pose.z + (dz || 0)
    });
    registeredCamera.setPose(next.x, next.y, next.z);
  };
  `
      : ''
  }

  ${
    includeFullscreen
      ? `
  var fullscreenButton = byAction('fullscreen');
  if (fullscreenButton) {
    fullscreenButton.addEventListener('click', function () {
      if (document.fullscreenElement) {
        document.exitFullscreen && document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      }
    });
    document.addEventListener('fullscreenchange', function () {
      setLabel(fullscreenButton, document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen');
    });
  }
  `
      : ''
  }
  }
  function markRuntimeReady() {
    if (runtimeFailed) return;
    runtimeReady = true;
    var el = document.getElementById('art-piece-runtime-ready');
    if (el) el.hidden = false;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setupControls();
      setTimeout(function () {
        setTimeout(markRuntimeReady, 0);
      }, 0);
    });
  } else {
    setupControls();
    setTimeout(function () {
      setTimeout(markRuntimeReady, 0);
    }, 0);
  }
})();
</script>`;
}
