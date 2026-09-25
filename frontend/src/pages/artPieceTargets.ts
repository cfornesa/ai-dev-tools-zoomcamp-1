import type { AITargetOption } from './aiTargeting';
import type { ArtPieceLibrary } from '../api/artPieces';

const PART_MARKER = /(?:data-augmentr-part\s*=\s*["']([^"']+)["']|@augmentr-part\s+([\w:-]+))/gi;
const ASSET_MARKER = /(?:data-augmentr-asset\s*=\s*["']([^"']+)["']|@augmentr-asset\s+([\w.-]+))/gi;

function markedOptions(source: string, pattern: RegExp, type: 'part' | 'media'): AITargetOption[] {
  const seen = new Set<string>();
  const options: AITargetOption[] = [];
  for (const match of source.matchAll(pattern)) {
    const id = match[1] ?? match[2];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    options.push({
      id,
      label: id,
      type,
      mentionKind: type === 'media' ? 'asset' : 'element',
      category: type === 'part' ? 'Parts' : 'Assets',
      descendantIds: [id],
    });
  }
  return options;
}

export function buildArtPieceTargetOptions(source: string): AITargetOption[] {
  const options: AITargetOption[] = [
    ...markedOptions(source, PART_MARKER, 'part'),
    ...markedOptions(source, ASSET_MARKER, 'media'),
  ];
  const seen = new Set(options.map((option) => option.id));
  const push = (option: AITargetOption) => {
    if (!seen.has(option.id)) {
      seen.add(option.id);
      options.push(option);
    }
  };
  for (const match of source.matchAll(/^\s*(?:\/\/|<!--)\s*@layer\s+(.+?)(?:\s*-->)?\s*$/gim)) {
    const id = match[1].trim();
    push({
      id,
      label: id,
      type: 'part',
      mentionKind: 'region',
      category: 'Regions',
      descendantIds: [id],
    });
  }
  return options;
}

export function buildArtPieceTargetOptionsForPiece(
  source: string,
  engine: ArtPieceLibrary,
  hasInk: boolean,
): AITargetOption[] {
  const options = buildArtPieceTargetOptions(source);
  const seen = new Set(options.map((option) => option.id));
  if (hasInk && !seen.has('ink')) {
    options.unshift({
      id: 'ink',
      label: 'Ink layer',
      type: 'part',
      mentionKind: 'ink',
      category: 'Layers',
      descendantIds: ['ink'],
    });
  }
  if (engine === 'svg' && typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    const existing = new Set(options.map((option) => option.id));
    document.querySelectorAll('[id]').forEach((element) => {
      const id = element.getAttribute('id');
      if (!id || existing.has(id)) return;
      existing.add(id);
      options.push({
        id,
        label: id,
        type: 'part',
        mentionKind: 'element',
        category: 'SVG elements',
        descendantIds: [id],
      });
    });
  }
  return options;
}
