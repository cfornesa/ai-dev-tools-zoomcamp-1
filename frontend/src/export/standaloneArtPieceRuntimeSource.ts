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
import type { ArtPieceCapabilitySet, ArtPieceLibrary } from '../api/artPieces';
import type { ArtPieceExportMode } from '../generative/artPieceBundle';

const SPATIAL_LIBRARIES: ArtPieceLibrary[] = ['threejs', 'aframe'];

export function buildStandaloneArtPieceRuntimeScript(
  library: ArtPieceLibrary,
  capabilities: ArtPieceCapabilitySet,
  mode: ArtPieceExportMode,
): string {
  const includeSound = capabilities.sound === true;
  const includeKeyboard = capabilities.keyboard === true;
  const includeMicrophone = capabilities.microphone === true;
  // Non-Camera ZIP (#437) owns device-isolation verification; this
  // module still respects capabilities/mode so #436's own Full ZIP
  // fixture (camera+steering enabled) has real code to exercise, and so
  // a non-camera export never even defines a getUserMedia call path.
  const includeCamera = mode === 'full' && capabilities.camera_view === true;
  const includeSteering =
    mode === 'full' && capabilities.hand_steering === true && SPATIAL_LIBRARIES.includes(library);
  const includeFullscreen = capabilities.fullscreen !== false;
  const includeScreenshot = capabilities.screenshot !== false;

  return `<script>
(function () {
  var pieceLibrary = ${JSON.stringify(library)};
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

  function setupControls() {
  function byAction(action) { return document.querySelector('[data-action="' + action + '"]'); }
  function setStatus(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function reportError(message) {
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
      window.dispatchEvent(new CustomEvent('art-piece-command', { detail: { type: 'reset-view', version: 1 } }));
    });
  }

  ${
    includeScreenshot
      ? `
  // Screenshot: same camera-compositing behavior as the live preview --
  // the camera overlay (if active) is drawn on top of the artwork in
  // the same stacking order it renders live, at its current opacity.
  function compositeScreenshot(baseCanvas) {
    var video = document.getElementById('art-piece-camera-overlay');
    if (!video || !video.videoWidth) return baseCanvas.toDataURL('image/png');
    var composite = document.createElement('canvas');
    composite.width = baseCanvas.width;
    composite.height = baseCanvas.height;
    var ctx = composite.getContext('2d');
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.save();
    ctx.globalAlpha = cameraOpacity;
    ctx.drawImage(video, 0, 0, composite.width, composite.height);
    ctx.restore();
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
          var svg = document.querySelector('svg');
          if (!svg) throw new Error('This piece has no capturable artwork.');
          var svgText = new XMLSerializer().serializeToString(svg);
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
  var soundOn = false;
  var soundButton = byAction('sound');
  function ensureAudio() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.2;
      masterGain.connect(audioCtx.destination);
    }
    return audioCtx;
  }
  if (soundButton) {
    soundButton.addEventListener('click', function () {
      ensureAudio();
      soundOn = !soundOn;
      if (soundOn) { audioCtx.resume(); } else { audioCtx.suspend(); }
      soundButton.setAttribute('aria-pressed', String(soundOn));
      soundButton.textContent = soundOn ? 'Mute sound' : 'Unmute sound';
      setStatus('art-piece-sound-status', soundOn ? 'Sound is on.' : 'Sound is off.');
    });
  }
  ${
    includeKeyboard
      ? `
  var NOTE_FREQUENCIES = { a: 220.0, s: 246.94, d: 261.63, f: 293.66, g: 329.63, h: 349.23, j: 392.0, k: 440.0 };
  window.addEventListener('keydown', function (event) {
    if (!soundOn || !audioCtx) return;
    var frequency = NOTE_FREQUENCIES[(event.key || '').toLowerCase()];
    if (!frequency) return;
    var oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    oscillator.connect(masterGain);
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
  var steerButton = byAction('hand');
  if (steerButton) {
    steerButton.addEventListener('click', function () {
      if (steeringActive) {
        steeringActive = false;
        steerButton.setAttribute('aria-pressed', 'false');
        steerButton.textContent = 'Steer the piece';
        setStatus('art-piece-steering-status', 'Steering is off.');
        return;
      }
      if (typeof cameraStream === 'undefined' || !cameraStream) {
        setStatus('art-piece-steering-status', 'Turn on Camera view before steering.');
        return;
      }
      if (!registeredCamera) {
        setStatus('art-piece-steering-status', "This piece hasn't set up a walkable camera yet.");
        return;
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
      fullscreenButton.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
    });
  }
  `
      : ''
  }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupControls);
  } else {
    setupControls();
  }
})();
</script>`;
}
