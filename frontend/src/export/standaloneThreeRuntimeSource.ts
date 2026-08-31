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
 * No `OrbitControls` here (out of scope for issue #289's own core-
 * generator acceptance criteria, which only requires the piece renders
 * standalone) -- a static camera, matching the saved document's own
 * `camera.position`/`camera.target` exactly, same as a screenshot of the
 * live preview would show before any interaction.
 */
export function buildStandaloneThreeRuntimeScript(): string {
  return `
(function () {
  var scene3d = window.__SCENE3D_DATA__;

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

    window.addEventListener('resize', function () {
      var next = currentSize();
      renderer.setSize(next.width, next.height, false);
      graph.camera.aspect = next.width / next.height;
      graph.camera.updateProjectionMatrix();
    });

    function tick() {
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
}
