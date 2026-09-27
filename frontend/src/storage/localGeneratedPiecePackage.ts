import { buildPiecePackage, parsePiecePackage } from './piecePackage';
import type { LocalPieceVersionRecord, LocalProjectRecord } from './localProjectRepository';

export async function buildLocalGeneratedPiecePackage(
  project: Pick<LocalProjectRecord, 'title'>,
  versions: LocalPieceVersionRecord[],
): Promise<Uint8Array> {
  const ordered = versions.slice().sort((a, b) => a.sequence - b.sequence);
  const payload = ordered.at(-1)?.payload ?? {};
  const bytes = await buildPiecePackage({
    kind: 'generated',
    title: project.title,
    description: String(payload.description ?? ''),
    visibilityIntent: 'private',
    appVersion: 'augmentrart-local',
    records: ordered.map((version) => ({ schemaVersion: 1, data: version.payload })),
    source: { engine: payload.engine ?? 'svg', source: payload.source ?? '' },
    ink: (payload.ink as Record<string, unknown> | null | undefined) ?? null,
    sonic: (payload.sonic as Record<string, unknown> | null | undefined) ?? null,
    capabilities: (payload.capabilities as Record<string, unknown> | undefined) ?? {},
  });
  await parsePiecePackage(bytes);
  return bytes;
}

export function localGeneratedPackageFilename(title: string): string {
  const slug = title
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${slug || 'generated-art'}-local-package.zip`;
}
