import type { AITargetOption } from './aiTargeting';

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
      category: type === 'part' ? 'Parts' : 'Assets',
      descendantIds: [id],
    });
  }
  return options;
}

export function buildArtPieceTargetOptions(source: string): AITargetOption[] {
  return [
    ...markedOptions(source, PART_MARKER, 'part'),
    ...markedOptions(source, ASSET_MARKER, 'media'),
  ];
}
