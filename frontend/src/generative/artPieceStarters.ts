import type { ArtPieceLibrary } from '../api/artPieces';

/** Safe, self-contained starter source for each registered generated-piece engine.
 * The values follow the input contract of buildArtPieceSandboxDocument and are
 * rendered only inside its allow-scripts sandbox. */
export const ART_PIECE_STARTERS: Readonly<Record<ArtPieceLibrary, string>> = {
  canvas2d: `<canvas id="art-piece-canvas" width="800" height="600"></canvas>
<script>
var canvas = document.getElementById('art-piece-canvas');
var ctx = canvas.getContext('2d');
var sky = ctx.createLinearGradient(0, 0, 0, 420);
sky.addColorStop(0, '#18244b'); sky.addColorStop(1, '#f59c62');
ctx.fillStyle = sky; ctx.fillRect(0, 0, 800, 600);
ctx.fillStyle = '#ffe7a0'; ctx.beginPath(); ctx.arc(580, 290, 58, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = '#493c69'; ctx.beginPath(); ctx.moveTo(0, 420); ctx.lineTo(190, 290); ctx.lineTo(360, 420); ctx.fill();
ctx.fillStyle = '#302c50'; ctx.beginPath(); ctx.moveTo(250, 430); ctx.lineTo(500, 300); ctx.lineTo(800, 445); ctx.fill();
ctx.fillStyle = '#17455d'; ctx.fillRect(0, 430, 800, 170);
ctx.strokeStyle = '#ffc982'; ctx.lineWidth = 3;
for (var i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(80 + i * 95, 470 + (i % 2) * 22); ctx.lineTo(145 + i * 95, 470 + (i % 2) * 22); ctx.stroke(); }
</script>`,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="Sunset over a layered sea">
<defs><linearGradient id="starter-sky" x2="0" y2="1"><stop stop-color="#18244b"/><stop offset="1" stop-color="#f59c62"/></linearGradient></defs>
<rect width="800" height="600" fill="url(#starter-sky)"/><circle cx="580" cy="290" r="58" fill="#ffe7a0"/>
<path d="M0 420 190 290 360 420Z" fill="#493c69"/><path d="m250 430 250-130 300 145Z" fill="#302c50"/>
<path d="M0 430h800v170H0z" fill="#17455d"/>
<g stroke="#ffc982" stroke-width="4"><path d="M80 470h65m45 22h65m45-22h65m45 22h65m45-22h65m45 22h65m45-22h65"/></g>
<path d="m530 418 18-70 18 70zm9-71h18v-40h-18z" fill="#f5e8c8" stroke="#352f50" stroke-width="3"/>
</svg>`,
  p5js: `window.sketch = function (p) {
  p.setup = function () { p.createCanvas(800, 600); p.noLoop(); };
  p.draw = function () {
    for (var y = 0; y < 430; y++) { p.stroke(p.lerpColor(p.color('#18244b'), p.color('#f59c62'), y / 430)); p.line(0, y, 800, y); }
    p.noStroke(); p.fill('#ffe7a0'); p.circle(580, 290, 116);
    p.fill('#493c69'); p.triangle(0, 420, 190, 290, 360, 420);
    p.fill('#302c50'); p.quad(250, 430, 500, 300, 800, 445, 800, 430);
    p.fill('#17455d'); p.rect(0, 430, 800, 170);
    p.stroke('#ffc982'); p.strokeWeight(3); for (var i = 0; i < 7; i++) p.line(80 + i * 95, 470 + (i % 2) * 22, 145 + i * 95, 470 + (i % 2) * 22);
  };
};`,
  c2js: `window.sketch = function ({ canvas, startFrame }) {
  startFrame(function () {
    var ctx = canvas.getContext('2d'), sky = ctx.createLinearGradient(0, 0, 0, 430);
    sky.addColorStop(0, '#18244b'); sky.addColorStop(1, '#f59c62');
    ctx.fillStyle = '#17455d'; ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1280, 430);
    ctx.fillStyle = '#ffe7a0'; ctx.beginPath(); ctx.arc(930, 290, 58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#493c69'; ctx.beginPath(); ctx.moveTo(0, 420); ctx.lineTo(300, 290); ctx.lineTo(560, 420); ctx.fill();
    ctx.fillStyle = '#302c50'; ctx.beginPath(); ctx.moveTo(400, 430); ctx.lineTo(760, 300); ctx.lineTo(1280, 445); ctx.fill();
    ctx.strokeStyle = '#ffc982'; ctx.lineWidth = 5;
    for (var i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(100 + i * 145, 490 + (i % 2) * 24); ctx.lineTo(190 + i * 145, 490 + (i % 2) * 24); ctx.stroke(); }
  });
  return {};
};`,
  'c2js-interactive': `window.sketch = function ({ startFrame, canvas }) {
  var warm = false;
  canvas.addEventListener('pointerdown', function () { warm = !warm; });
  startFrame(function (frame) {
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = warm ? '#422f4c' : '#17455d'; ctx.fillRect(0, 0, 1280, 720);
    var sky = ctx.createLinearGradient(0, 0, 0, 430);
    sky.addColorStop(0, warm ? '#542e59' : '#18244b'); sky.addColorStop(1, '#f59c62');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1280, 430);
    ctx.fillStyle = '#ffe7a0'; ctx.beginPath(); ctx.arc(930, 290, 58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#493c69'; ctx.beginPath(); ctx.moveTo(0, 420); ctx.lineTo(300, 290); ctx.lineTo(560, 420); ctx.fill();
    ctx.fillStyle = '#302c50'; ctx.beginPath(); ctx.moveTo(400, 430); ctx.lineTo(760, 300); ctx.lineTo(1280, 445); ctx.fill();
    ctx.strokeStyle = '#ffc982'; ctx.lineWidth = 5;
    for (var i = 0; i < 8; i++) { var x = (100 + i * 145 + frame * 2) % 1280; ctx.beginPath(); ctx.moveTo(x, 490 + (i % 2) * 24); ctx.lineTo(x + 80, 490 + (i % 2) * 24); ctx.stroke(); }
  });
  return {};
};`,
  threejs: `var container = document.getElementById('art-piece-container');
var scene = new THREE.Scene(); scene.background = new THREE.Color('#18244b');
var camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100); camera.position.set(0, 5, 12); camera.lookAt(0, 1, 0);
var renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(800, 600); container.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffd9a0, 0x263454, 2));
var sun = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 24), new THREE.MeshBasicMaterial({ color: '#ffe7a0' })); sun.position.set(4, 3, -2); scene.add(sun);
var sea = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshStandardMaterial({ color: '#17455d', roughness: 0.7 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.2; scene.add(sea);
for (var i = 0; i < 3; i++) { var hill = new THREE.Mesh(new THREE.ConeGeometry(3 - i * 0.45, 3.2, 5), new THREE.MeshStandardMaterial({ color: i === 0 ? '#493c69' : '#302c50' })); hill.position.set(-4 + i * 4, 1.1, -2 - i); scene.add(hill); }
var boat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: '#f5e8c8' })); boat.position.set(0, 0.4, 1); scene.add(boat);
renderer.render(scene, camera);`,
  aframe: `<a-scene id="art-piece-scene" embedded background="color: #18244b" renderer="colorManagement: true">
<a-entity light="type: ambient; color: #ffe7a0; intensity: 0.8"></a-entity>
<a-entity position="4 3 -2" light="type: point; color: #ffe7a0; intensity: 1.5"></a-entity>
<a-sphere position="4 3 -2" radius="0.9" color="#ffe7a0"></a-sphere>
<a-box position="0 -0.5 -2" width="20" height="0.2" depth="12" color="#17455d"></a-box>
<a-cone position="-4 0.8 -3" radius-bottom="2.5" radius-top="0" height="3" color="#493c69"></a-cone>
<a-cone position="0 1.2 -4" radius-bottom="2.2" radius-top="0" height="3.6" color="#302c50"></a-cone>
<a-cone position="4 0.7 -2" radius-bottom="2.7" radius-top="0" height="2.8" color="#493c69"></a-cone>
<a-entity position="0 0 0"><a-camera position="0 2 12" look-controls="enabled: false"></a-camera></a-entity>
</a-scene>`,
};

export function getArtPieceStarter(library: ArtPieceLibrary): string {
  return ART_PIECE_STARTERS[library];
}
