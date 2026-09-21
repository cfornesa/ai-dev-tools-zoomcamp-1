import type { ArtPieceLibrary } from '../api/artPieces';

export type Generated2DManualTool =
  'add-shape' | 'add-ellipse' | 'add-line' | 'freehand-draw' | 'erase';

const START = '/* AUGMENTRART_EDITABLE_START */';
const END = '/* AUGMENTRART_EDITABLE_END */';
const SVG_START = '<!-- AUGMENTRART_EDITABLE_START -->';
const SVG_END = '<!-- AUGMENTRART_EDITABLE_END -->';

const CANVAS_SNIPPETS: Record<Generated2DManualTool, string> = {
  'add-shape': "ctx.fillStyle='#f59e0b';ctx.fillRect(80,80,80,80);",
  'add-ellipse':
    "ctx.fillStyle='#10b981';ctx.beginPath();ctx.ellipse(120,120,48,32,0,0,Math.PI*2);ctx.fill();",
  'add-line':
    "ctx.strokeStyle='#2563eb';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(40,40);ctx.lineTo(260,180);ctx.stroke();",
  'freehand-draw':
    "ctx.strokeStyle='#dc2626';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(60,180);ctx.lineTo(100,140);ctx.lineTo(140,180);ctx.lineTo(180,140);ctx.stroke();",
  erase: 'ctx.clearRect(72,72,96,96);',
};

const SVG_SNIPPETS: Record<Generated2DManualTool, string> = {
  'add-shape': '<rect x="80" y="80" width="80" height="80" fill="#f59e0b"/>',
  'add-ellipse': '<ellipse cx="120" cy="120" rx="48" ry="32" fill="#10b981"/>',
  'add-line': '<line x1="40" y1="40" x2="260" y2="180" stroke="#2563eb" stroke-width="5"/>',
  'freehand-draw':
    '<path d="M60 180 L100 140 L140 180 L180 140" fill="none" stroke="#dc2626" stroke-width="4"/>',
  erase: '<rect x="72" y="72" width="96" height="96" fill="white"/>',
};

export function appendGenerated2DEdit(
  source: string,
  engine: Extract<ArtPieceLibrary, 'canvas2d' | 'svg'>,
  tool: Generated2DManualTool,
): string {
  const snippet =
    engine === 'svg'
      ? SVG_SNIPPETS[tool]
      : `var canvas=document.getElementById('art-piece-canvas');var ctx=canvas&&canvas.getContext('2d');if(ctx){${CANVAS_SNIPPETS[tool]}}`;
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startMarker = engine === 'svg' ? SVG_START : START;
  const endMarker = engine === 'svg' ? SVG_END : END;
  const existing = source.match(
    new RegExp(`${escapeRegExp(startMarker)}([\\s\\S]*?)${escapeRegExp(endMarker)}`),
  );
  const body = `${existing?.[1] ?? ''}\n${snippet}`;
  const replacement = `${startMarker}\n${body}\n${endMarker}`;
  if (existing) return source.replace(existing[0], replacement);
  if (engine === 'svg' && source.includes('</svg>'))
    return source.replace('</svg>', `${replacement}</svg>`);
  return `${source}\n<script>${replacement}</script>`;
}
