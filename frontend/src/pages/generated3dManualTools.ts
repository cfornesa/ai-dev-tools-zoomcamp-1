import type { ArtPieceLibrary } from '../api/artPieces';

export type Generated3DPrimitive = 'add-box' | 'add-sphere' | 'add-plane';

export type Generated3DTransform = {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
};

export type Generated3DObject = {
  id: string;
  label: string;
};

const START = '/* AUGMENTRART_EDITABLE_START */';
const END = '/* AUGMENTRART_EDITABLE_END */';
const AFRAME_START = '<!-- AUGMENTRART_EDITABLE_START -->';
const AFRAME_END = '<!-- AUGMENTRART_EDITABLE_END -->';

const DEFAULT_TRANSFORM: Generated3DTransform = {
  x: 0,
  y: 0,
  z: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
};

const COLORS: Record<Generated3DPrimitive, string> = {
  'add-box': '0xf59e0b',
  'add-sphere': '0x10b981',
  'add-plane': '0x2563eb',
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function markerRegion(
  source: string,
  start: string,
  end: string,
): { full: string; body: string } | null {
  const match = source.match(new RegExp(`${escapeRegExp(start)}([\\s\\S]*?)${escapeRegExp(end)}`));
  return match ? { full: match[0], body: match[1] } : null;
}

function nextId(source: string, primitive: Generated3DPrimitive): string {
  const prefix = `augmentrart-${primitive.replace('add-', '')}-`;
  const matches = [...source.matchAll(new RegExp(`${escapeRegExp(prefix)}(\\d+)`, 'g'))];
  const next = matches.reduce((highest, match) => Math.max(highest, Number(match[1])), 0) + 1;
  return `${prefix}${next}`;
}

function threePrimitiveSnippet(id: string, primitive: Generated3DPrimitive): string {
  const geometry =
    primitive === 'add-box'
      ? 'new THREE.BoxGeometry(1, 1, 1)'
      : primitive === 'add-sphere'
        ? 'new THREE.SphereGeometry(0.65, 24, 16)'
        : 'new THREE.PlaneGeometry(1.5, 1.5)';
  return `var ${id.replaceAll('-', '_')} = new THREE.Mesh(${geometry}, new THREE.MeshNormalMaterial({color:${COLORS[primitive]}}));
${id.replaceAll('-', '_')}.name='${id}';
${id.replaceAll('-', '_')}.position.set(0,0,0);
${id.replaceAll('-', '_')}.rotation.set(0,0,0);
${id.replaceAll('-', '_')}.scale.set(1,1,1);
var ${id.replaceAll('-', '_')}_outline = new THREE.LineSegments(new THREE.EdgesGeometry(${id.replaceAll('-', '_')}.geometry), new THREE.LineBasicMaterial({color:0xffffff}));
${id.replaceAll('-', '_')}_outline.name='${id}-outline';
${id.replaceAll('-', '_')}.add(${id.replaceAll('-', '_')}_outline);
scene.add(${id.replaceAll('-', '_')});`;
}

function aframePrimitiveSnippet(id: string, primitive: Generated3DPrimitive): string {
  const tag =
    primitive === 'add-box' ? 'a-box' : primitive === 'add-sphere' ? 'a-sphere' : 'a-plane';
  const geometry = primitive === 'add-plane' ? ' rotation="-90 0 0"' : '';
  return `<a-light type="ambient" color="#ffffff" intensity="2"></a-light><${tag} id="${id}" position="0 1.6 -4" rotation="0 0 0" scale="1 1 1" material="color: #${COLORS[
    primitive
  ].slice(
    2,
  )}; shader: flat"${geometry}><a-entity geometry="primitive: box; width: 1.08; height: 1.08; depth: 1.08" material="color: #ffffff; shader: flat; wireframe: true"></a-entity></${tag}>`;
}

function ensureAFrameRendererBuffer(source: string): string {
  if (!source.includes('<a-scene') || /<a-scene[^>]*\brenderer=/.test(source)) return source;
  return source.replace(
    '<a-scene',
    '<a-scene renderer="preserveDrawingBuffer: true; antialias: true"',
  );
}

export function listGenerated3DObjects(
  source: string,
  engine: Extract<ArtPieceLibrary, 'threejs' | 'aframe'>,
): Generated3DObject[] {
  const pattern =
    engine === 'aframe'
      ? /id="(augmentrart-(?:box|sphere|plane)-\d+)"/g
      : /name=['"](augmentrart-(?:box|sphere|plane)-\d+)['"]/g;
  return [...source.matchAll(pattern)].map((match) => ({ id: match[1], label: match[1] }));
}

export function appendGenerated3DPrimitive(
  source: string,
  engine: Extract<ArtPieceLibrary, 'threejs' | 'aframe'>,
  primitive: Generated3DPrimitive,
): { source: string; id: string } {
  const id = nextId(source, primitive);
  if (engine === 'aframe') {
    source = ensureAFrameRendererBuffer(source);
    const existing = markerRegion(source, AFRAME_START, AFRAME_END);
    const body = `${existing?.body ?? ''}\n${aframePrimitiveSnippet(id, primitive)}`;
    const replacement = `${AFRAME_START}\n${body}\n${AFRAME_END}`;
    if (existing) return { source: source.replace(existing.full, replacement), id };
    if (source.includes('</a-scene>')) {
      return { source: source.replace('</a-scene>', `${replacement}</a-scene>`), id };
    }
    return { source: `${source}${replacement}`, id };
  }

  const existing = markerRegion(source, START, END);
  const body = `${existing?.body ?? ''}\n${threePrimitiveSnippet(id, primitive)}`;
  const replacement = `${START}\n${body}\n${END}\nif (typeof renderer !== 'undefined') renderer.render(scene,camera);`;
  if (existing) return { source: source.replace(existing.full, replacement), id };
  return { source: `${source}\n${replacement}`, id };
}

function number(value: number): string {
  return Number.isFinite(value) ? String(value) : '0';
}

export function applyGenerated3DTransform(
  source: string,
  engine: Extract<ArtPieceLibrary, 'threejs' | 'aframe'>,
  id: string,
  transform: Generated3DTransform,
): string {
  if (engine === 'aframe') {
    const pattern = new RegExp(
      `<((?:a-box|a-sphere|a-plane)[^>]*\\bid="${escapeRegExp(id)}"[^>]*)>`,
    );
    return source.replace(pattern, (_match, attributes: string) => {
      const next = attributes
        .replace(/\sposition="[^"]*"/, '')
        .replace(/\srotation="[^"]*"/, '')
        .replace(/\sscale="[^"]*"/, '');
      return `<${next} position="${number(transform.x)} ${number(transform.y)} ${number(transform.z)}" rotation="${number(transform.rotationX)} ${number(transform.rotationY)} ${number(transform.rotationZ)}" scale="${number(transform.scaleX)} ${number(transform.scaleY)} ${number(transform.scaleZ)}">`;
    });
  }
  const variable = id.replaceAll('-', '_');
  return source
    .replace(
      new RegExp(`${escapeRegExp(variable)}\\.position\\.set\\([^)]*\\)`),
      `${variable}.position.set(${number(transform.x)},${number(transform.y)},${number(transform.z)})`,
    )
    .replace(
      new RegExp(`${escapeRegExp(variable)}\\.rotation\\.set\\([^)]*\\)`),
      `${variable}.rotation.set(${number(transform.rotationX)}*Math.PI/180,${number(transform.rotationY)}*Math.PI/180,${number(transform.rotationZ)}*Math.PI/180)`,
    )
    .replace(
      new RegExp(`${escapeRegExp(variable)}\\.scale\\.set\\([^)]*\\)`),
      `${variable}.scale.set(${number(transform.scaleX)},${number(transform.scaleY)},${number(transform.scaleZ)})`,
    );
}

export function defaultGenerated3DTransform(): Generated3DTransform {
  return { ...DEFAULT_TRANSFORM };
}
