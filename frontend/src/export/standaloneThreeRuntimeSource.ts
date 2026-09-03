/**
 * Issue #289: a self-contained (no ES modules, no bundler, no import of
 * this app's own `render/threeSceneBuilder.ts`) re-implementation of that
 * module's scene-graph-building logic, written as a plain JS string this
 * app's export path can drop into a downloaded `scripts/piece.js` file.
 * Runs against a vendored global `THREE` (the UMD build fetched from the
 * pinned CDN URL, matching `../generative/artPieceBundle.ts`'s existing
 * `LIBRARY_CDN.threejs` entry) rather than an ESM import, since a
 * double-clicked `file://` page can't resolve bare module specifiers.
 *
 * Deliberately mirrors `threeSceneBuilder.ts`'s box/sphere/cylinder/plane
 * geometry, material, light, camera, and group/transform logic field for
 * field -- an exported piece should look identical to the live editor
 * preview it was exported from, not a simplified stand-in.
 *
 * The runtime includes a small dependency-free orbit/zoom interaction so
 * the downloaded piece retains the same basic view controls as the live
 * preview without needing to vendor OrbitControls.
 */
export function buildStandaloneThreeRuntimeScript(
  options: { includeCameraFeatures?: boolean; immersive?: boolean } = {},
): string {
  const includeCameraFeatures = options.includeCameraFeatures ?? true;
  const immersive = options.immersive ?? false;
  const source = `
(function () {
  var scene3d = window.__SCENE3D_DATA__;
  window.__EXPORT_SURFACE_MODE__ = ${JSON.stringify(immersive ? 'immersive' : 'regular')};

  function applyTransform(target, transform) {
    target.position.set(transform.position.x, transform.position.y, transform.position.z);
    target.rotation.set(
      THREE.MathUtils.degToRad(transform.rotation.x),
      THREE.MathUtils.degToRad(transform.rotation.y),
      THREE.MathUtils.degToRad(transform.rotation.z),
      'XYZ'
    );
    target.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
  }

  function buildGeometry(object) {
    switch (object.type) {
      case 'box':
        return new THREE.BoxGeometry(object.width || 1, object.height || 1, object.depth || 1);
      case 'sphere':
        return new THREE.SphereGeometry(object.radius || 1, 24, 16);
      case 'cylinder':
        return new THREE.CylinderGeometry(
          object.radiusTop || 1,
          object.radiusBottom || 1,
          object.height || 1,
          16
        );
      case 'plane':
        return new THREE.PlaneGeometry(object.width || 1, object.height || 1);
      default:
        throw new Error('Unknown object type: ' + object.type);
    }
  }

  function buildMaterial(object) {
    var opacity = object.material.opacity == null ? 1 : object.material.opacity;
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(object.material.color),
      emissive: object.material.emissive ? new THREE.Color(object.material.emissive) : undefined,
      opacity: opacity,
      transparent: opacity < 1,
      side: object.type === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
    });
  }

  function buildObjectMesh(object) {
    var mesh = new THREE.Mesh(buildGeometry(object), buildMaterial(object));
    applyTransform(mesh, object.transform);
    mesh.visible = object.visible;
    mesh.name = object.id;
    return mesh;
  }

  function buildGroupNode(group) {
    var node = new THREE.Group();
    applyTransform(node, group.transform);
    node.visible = group.visible;
    node.name = group.id;
    return node;
  }

  function buildLight(light) {
    var color = new THREE.Color(light.color);
    if (light.type === 'ambient') {
      return new THREE.AmbientLight(color, light.intensity);
    }
    if (light.type === 'directional') {
      var directional = new THREE.DirectionalLight(color, light.intensity);
      var direction = light.direction || { x: 0, y: -1, z: 0 };
      directional.position.set(-direction.x, -direction.y, -direction.z);
      directional.target.position.set(0, 0, 0);
      return directional;
    }
    var point = new THREE.PointLight(color, light.intensity);
    var position = light.position || { x: 0, y: 0, z: 0 };
    point.position.set(position.x, position.y, position.z);
    return point;
  }

  function buildCamera(camera, aspect) {
    var result = new THREE.PerspectiveCamera(camera.fov, aspect, camera.near, camera.far);
    result.position.set(camera.position.x, camera.position.y, camera.position.z);
    result.lookAt(camera.target.x, camera.target.y, camera.target.z);
    return result;
  }

  function isZeroContentScene(doc) {
    return doc.objects.length === 0 && doc.lights.length === 0 && doc.groups.length === 0;
  }

  function buildSceneGraph(doc, aspect) {
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(
      isZeroContentScene(doc) ? '#808080' : doc.scene.backgroundColor
    );

    for (var i = 0; i < doc.lights.length; i += 1) {
      var built = buildLight(doc.lights[i]);
      scene.add(built);
      if (built instanceof THREE.DirectionalLight) {
        scene.add(built.target);
      }
    }

    var groupNodes = {};
    for (var g = 0; g < doc.groups.length; g += 1) {
      var group = doc.groups[g];
      var node = buildGroupNode(group);
      groupNodes[group.id] = node;
      scene.add(node);
    }

    for (var o = 0; o < doc.objects.length; o += 1) {
      var object = doc.objects[o];
      var mesh = buildObjectMesh(object);
      var parent = object.groupId !== null ? groupNodes[object.groupId] : undefined;
      (parent || scene).add(mesh);
    }

    return { scene: scene, camera: buildCamera(doc.camera, aspect) };
  }

  function start() {
    var host = document.getElementById('scene3d-canvas-host');
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    host.appendChild(renderer.domElement);

    function currentSize() {
      var width = host.clientWidth || 1;
      var height = host.clientHeight || 1;
      return { width: width, height: height };
    }

    var size = currentSize();
    renderer.setSize(size.width, size.height, false);
    var graph = buildSceneGraph(scene3d, size.width / size.height);
    var activeHandInput = null;
    var previousHand = null;
    // The Full export's standalone camera module installs the same optional
    // input contract used by the 2D export. Keeping this bridge on window
    // lets that module remain reusable while Three.js consumes its signals
    // locally for orbit control.
    window.__exportSetActiveInput = function (input) {
      activeHandInput = input;
      previousHand = null;
    };
    var audioContext = null;
    var masterGain = null;
    var soundEnabled = false;
    var keyboardEnabled = false;
    /* EXPORT_CAMERA_FEATURES_START */
    var micStream = null;
    var micSource = null;
    var thereminEnabled = false;
    var thereminOscillator = null;
    var thereminGain = null;
    /* EXPORT_CAMERA_FEATURES_END */
    var lastToneAt = 0;
    var notes = { a: 261.63, s: 293.66, d: 329.63, f: 349.23, g: 392.0, h: 440.0, j: 493.88, k: 523.25, l: 587.33 };

    function setSoundButton() {
      var button = document.getElementById('piece-sound');
      if (!button) return;
      button.setAttribute('aria-pressed', String(soundEnabled));
      button.setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Enable sound');
      button.setAttribute('title', soundEnabled ? 'Mute sound' : 'Enable sound');
    }

    function playTone(frequency, duration) {
      if (!soundEnabled || !audioContext || !masterGain) return;
      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration + 0.02);
    }

    function toggleSound() {
      if (soundEnabled) {
        soundEnabled = false;
        keyboardEnabled = false;
        var keyboardButton = document.getElementById('piece-keyboard');
        if (keyboardButton) keyboardButton.setAttribute('aria-pressed', 'false');
        if (typeof stopMic === 'function') stopMic();
        if (typeof stopTheremin === 'function') stopTheremin();
        if (masterGain) masterGain.gain.value = 0;
        setSoundButton();
        return;
      }
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext = audioContext || new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume();
      masterGain = masterGain || audioContext.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(audioContext.destination);
      soundEnabled = true;
      setSoundButton();
      playTone(261.63, 0.25);
    }

    document.getElementById('piece-sound')?.addEventListener('click', toggleSound);
    document.getElementById('piece-audio-settings')?.addEventListener('click', function () {
      var panel = document.getElementById('piece-audio-controls');
      var button = document.getElementById('piece-audio-settings');
      if (!panel || !button) return;
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
    });
    document.getElementById('piece-volume')?.addEventListener('input', function (event) {
      if (masterGain) masterGain.gain.value = Number(event.target.value) / 100;
    });
    document.getElementById('piece-keyboard')?.addEventListener('click', function () {
      keyboardEnabled = !keyboardEnabled;
      this.setAttribute('aria-pressed', String(keyboardEnabled));
      this.textContent = keyboardEnabled ? 'Stop keyboard notes' : 'Keyboard notes';
    });
    /* EXPORT_CAMERA_FEATURES_START */
    function stopMic() {
      if (micSource) {
        micSource.disconnect();
        micSource = null;
      }
      if (micStream) {
        micStream.getTracks().forEach(function (track) { track.stop(); });
        micStream = null;
      }
      var micButton = document.getElementById('piece-mic');
      if (micButton) {
        micButton.setAttribute('aria-pressed', 'false');
        micButton.textContent = 'Live mic';
      }
    }
    document.getElementById('piece-mic')?.addEventListener('click', async function () {
      if (!soundEnabled || !audioContext || !masterGain) return;
      if (micStream) {
        stopMic();
        return;
      }
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(masterGain);
        this.setAttribute('aria-pressed', 'true');
        this.textContent = 'Stop live mic';
      } catch {
        stopMic();
        this.textContent = 'Mic unavailable';
      }
    });
    function stopTheremin() {
      if (thereminOscillator) {
        try { thereminOscillator.stop(); } catch {}
        thereminOscillator.disconnect();
        thereminOscillator = null;
      }
      if (thereminGain) {
        thereminGain.disconnect();
        thereminGain = null;
      }
      thereminEnabled = false;
      var thereminButton = document.getElementById('piece-theremin');
      if (thereminButton) {
        thereminButton.setAttribute('aria-pressed', 'false');
        thereminButton.textContent = 'Camera theremin';
      }
    }
    document.getElementById('piece-theremin')?.addEventListener('click', function () {
      if (!soundEnabled || !audioContext || !masterGain) return;
      if (thereminEnabled) {
        stopTheremin();
        return;
      }
      thereminOscillator = audioContext.createOscillator();
      thereminGain = audioContext.createGain();
      thereminOscillator.type = 'sine';
      thereminOscillator.frequency.value = 261.63;
      thereminGain.gain.value = 0;
      thereminOscillator.connect(thereminGain);
      thereminGain.connect(masterGain);
      thereminOscillator.start();
      thereminEnabled = true;
      this.setAttribute('aria-pressed', 'true');
      this.textContent = 'Stop camera theremin';
    });
    /* EXPORT_CAMERA_FEATURES_END */
    window.addEventListener('keydown', function (event) {
      if (!soundEnabled || !keyboardEnabled || event.repeat || event.target instanceof HTMLInputElement) return;
      var frequency = notes[event.key.toLowerCase()];
      if (frequency) playTone(frequency, 0.3);
    });
    var initialPosition = graph.camera.position.clone();
    var initialTarget = new THREE.Vector3(
      scene3d.camera.target.x,
      scene3d.camera.target.y,
      scene3d.camera.target.z
    );
    var target = initialTarget.clone();
    var orbit = { yaw: 0, pitch: 0, distance: graph.camera.position.distanceTo(target) };
    var dragging = false;
    var lastX = 0;
    var lastY = 0;
    var pressedArrows = {};
    var lastFrameAt = performance.now();

    function applyOrbit() {
      var cosPitch = Math.cos(orbit.pitch);
      graph.camera.position.set(
        target.x + orbit.distance * cosPitch * Math.sin(orbit.yaw),
        target.y + orbit.distance * Math.sin(orbit.pitch),
        target.z + orbit.distance * cosPitch * Math.cos(orbit.yaw)
      );
      graph.camera.lookAt(target);
    }

    function resetView() {
      graph.camera.position.copy(initialPosition);
      target.copy(initialTarget);
      orbit.distance = initialPosition.distanceTo(target);
      orbit.yaw = Math.atan2(initialPosition.x - target.x, initialPosition.z - target.z);
      orbit.pitch = Math.asin((initialPosition.y - target.y) / Math.max(orbit.distance, 0.001));
      graph.camera.lookAt(target);
    }

    // Keep the reference runtime's arrow-key travel behavior in downloaded
    // pieces. WASD remains reserved for the optional piano-key notes, so
    // these controls deliberately use arrows only. Both the camera and orbit
    // target move together, preserving the current view direction.
    function applyArrowTravel(deltaSeconds) {
      var x = 0;
      var z = 0;
      if (pressedArrows.ArrowUp) z += 1;
      if (pressedArrows.ArrowDown) z -= 1;
      if (pressedArrows.ArrowRight) x += 1;
      if (pressedArrows.ArrowLeft) x -= 1;
      if (x === 0 && z === 0) return;
      var forward = new THREE.Vector3().subVectors(target, graph.camera.position).normalize();
      var right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      var travel = new THREE.Vector3()
        .addScaledVector(forward, z)
        .addScaledVector(right, x)
        .normalize()
        .multiplyScalar(Math.min(deltaSeconds, 0.05) * 4);
      target.add(travel);
      applyOrbit();
    }

    // Keep the portable runtime's camera state inspectable for host integrations
    // and browser acceptance checks without coupling them to Three.js objects.
    window.__exportGetCameraState = function () {
      return {
        position: {
          x: graph.camera.position.x,
          y: graph.camera.position.y,
          z: graph.camera.position.z,
        },
        target: { x: target.x, y: target.y, z: target.z },
      };
    };

    window.addEventListener('keydown', function (event) {
      if (event.key.indexOf('Arrow') !== 0 || event.target instanceof HTMLInputElement) return;
      pressedArrows[event.key] = true;
      // Apply one bounded step immediately as well as during the animation
      // loop. This makes a discrete keyboard activation observable even when
      // a browser delivers keydown and keyup within one frame.
      applyArrowTravel(0.05);
      event.preventDefault();
    });
    window.addEventListener('keyup', function (event) {
      if (event.key.indexOf('Arrow') !== 0) return;
      pressedArrows[event.key] = false;
    });

    function applyHandCamera() {
      if (!activeHandInput || typeof activeHandInput.getSignals !== 'function') {
        previousHand = null;
        return;
      }
      var signals = activeHandInput.getSignals();
      if (!signals || !signals.handPresence || signals.palmX == null || signals.palmY == null) {
        previousHand = null;
        return;
      }
      if (previousHand) {
        orbit.yaw -= (signals.palmX - previousHand.x) * 2.2;
        orbit.pitch = Math.max(-1.45, Math.min(1.45, orbit.pitch + (signals.palmY - previousHand.y) * 1.8));
        if (signals.pinchStrength != null) {
          orbit.distance = Math.max(0.1, Math.min(1000, orbit.distance * (1 + (signals.pinchStrength - 0.5) * 0.018)));
        }
        applyOrbit();
      }
      /* EXPORT_CAMERA_FEATURES_START */
      if (thereminEnabled && thereminOscillator && thereminGain) {
        var midiNote = 36 + (1 - signals.palmY) * 24;
        thereminOscillator.frequency.setTargetAtTime(440 * Math.pow(2, (midiNote - 69) / 12), audioContext.currentTime, 0.05);
        var openness = signals.pinchStrength == null ? 0.5 : 1 - signals.pinchStrength;
        thereminGain.gain.setTargetAtTime(Math.max(0, Math.min(0.2, openness * 0.2)), audioContext.currentTime, 0.05);
      }
      /* EXPORT_CAMERA_FEATURES_END */
      previousHand = { x: signals.palmX, y: signals.palmY };
    }

    host.addEventListener('pointerdown', function (event) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      host.setPointerCapture?.(event.pointerId);
    });
    host.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      orbit.yaw -= (event.clientX - lastX) * 0.01;
      orbit.pitch = Math.max(-1.45, Math.min(1.45, orbit.pitch + (event.clientY - lastY) * 0.01));
      lastX = event.clientX;
      lastY = event.clientY;
      applyOrbit();
      var now = performance.now();
      if (soundEnabled && now - lastToneAt > 150) {
        lastToneAt = now;
        playTone(180 + Math.min(360, Math.abs(event.movementX || 0) * 12), 0.08);
      }
    });
    host.addEventListener('pointerup', function () { dragging = false; });
    host.addEventListener('pointercancel', function () { dragging = false; });
    host.addEventListener('wheel', function (event) {
      event.preventDefault();
      orbit.distance = Math.max(0.1, orbit.distance * Math.exp(event.deltaY * 0.001));
      applyOrbit();
    }, { passive: false });
    window.addEventListener('piece-reset-view', resetView);
    resetView();

    window.addEventListener('resize', function () {
      var next = currentSize();
      renderer.setSize(next.width, next.height, false);
      graph.camera.aspect = next.width / next.height;
      graph.camera.updateProjectionMatrix();
    });

    function tick() {
      var now = performance.now();
      applyArrowTravel((now - lastFrameAt) / 1000);
      lastFrameAt = now;
      applyHandCamera();
      renderer.render(graph.scene, graph.camera);
      requestAnimationFrame(tick);
    }
    tick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
`;
  return includeCameraFeatures
    ? source
    : source.replace(
        /\/\* EXPORT_CAMERA_FEATURES_START \*\/[\s\S]*?\/\* EXPORT_CAMERA_FEATURES_END \*\//g,
        '',
      );
}
