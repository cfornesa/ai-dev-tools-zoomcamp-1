import {
  getMediaBlob,
  getProject,
  listMediaAssetsForProject,
  listScenesForProject,
  listPieceVersions,
  type LocalPieceVersionRecord,
  type LocalMediaAssetRecord,
} from './localProjectRepository';

export type LocalPiecePackageModule = {
  buildPiecePackage: (input: {
    kind: '2d';
    title: string;
    description: string;
    appVersion: string;
    records: Array<{ schemaVersion: number; data: Record<string, unknown> }>;
    mediaAssets: Array<{
      filename: string;
      altText: string;
      mimeType: string;
      bytes: Uint8Array;
    }>;
  }) => Promise<Uint8Array>;
  parsePiecePackage: (bytes: Uint8Array) => Promise<unknown>;
};

async function loadPiecePackageModule(): Promise<LocalPiecePackageModule> {
  return import(/* @vite-ignore */ new URL('./piecePackage.js', import.meta.url).href);
}

export type LocalPiecePackageResult = {
  bytes: Uint8Array;
  missingAssets: LocalMediaAssetRecord[];
};

/** Builds any local-first piece kind for the explicit account-sync offer. */
export async function buildLocalPiecePackage(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
): Promise<LocalPiecePackageResult> {
  const project = await getProject(db, ownerId, projectId);
  if (!project) throw new Error('The local piece is missing or belongs to another owner.');
  const kind = project.kind ?? '2d';
  const assets = await listMediaAssetsForProject(db, projectId);
  const mediaAssets = [];
  const missingAssets: LocalMediaAssetRecord[] = [];
  for (const asset of assets) {
    const blob = await getMediaBlob(db, asset.id);
    if (!blob) {
      missingAssets.push(asset);
      continue;
    }
    mediaAssets.push({
      filename: asset.filename,
      altText: asset.altText,
      mimeType: asset.mimeType,
      bytes: new Uint8Array(await blob.arrayBuffer()),
    });
  }
  const scenes = (await listScenesForProject(db, projectId)).sort(
    (left, right) => left.position - right.position,
  );
  const versions: LocalPieceVersionRecord[] =
    kind === '2d' ? [] : await listPieceVersions(db, ownerId, projectId);
  const records =
    kind === '2d'
      ? scenes.map((scene) => ({ schemaVersion: 1, data: scene.sceneJson }))
      : versions.map((version) => ({ schemaVersion: 1, data: version.payload }));
  const latest = versions.at(-1)?.payload ?? {};
  const { buildPiecePackage, parsePiecePackage } = await import('./piecePackage');
  const bytes = await buildPiecePackage({
    kind,
    title: project.title,
    description: '',
    visibilityIntent: 'private',
    appVersion: 'augmentrart-local-sync',
    records,
    mediaAssets,
    source:
      kind === 'generated'
        ? { engine: latest.engine ?? 'svg', code: latest.source ?? '' }
        : kind === '3d'
          ? { renderer: latest.renderer ?? null }
          : null,
    ink: kind === 'generated' ? ((latest.ink as Record<string, unknown>) ?? null) : null,
    sonic: kind === 'generated' ? ((latest.sonic as Record<string, unknown>) ?? null) : null,
    capabilities:
      kind === 'generated' ? ((latest.capabilities as Record<string, unknown>) ?? {}) : null,
  });
  await parsePiecePackage(bytes);
  return { bytes, missingAssets };
}

/** Build and checksum-verify a single local 2D piece without mutating IndexedDB. */
export async function buildLocal2dPiecePackage(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
  packageModule?: LocalPiecePackageModule,
): Promise<LocalPiecePackageResult> {
  const project = await getProject(db, ownerId, projectId);
  if (!project) throw new Error('The local piece is missing or belongs to another owner.');
  const scenes = (await listScenesForProject(db, projectId)).sort(
    (left, right) => left.position - right.position,
  );
  const assets = await listMediaAssetsForProject(db, projectId);
  const mediaAssets = [];
  const missingAssets: LocalMediaAssetRecord[] = [];
  for (const asset of assets) {
    const blob = await getMediaBlob(db, asset.id);
    if (!blob) {
      missingAssets.push(asset);
      continue;
    }
    mediaAssets.push({
      filename: asset.filename,
      altText: asset.altText,
      mimeType: asset.mimeType,
      bytes: new Uint8Array(await blob.arrayBuffer()),
    });
  }
  const { buildPiecePackage, parsePiecePackage } =
    packageModule ?? (await loadPiecePackageModule());
  const bytes = await buildPiecePackage({
    kind: '2d',
    title: project.title,
    description: '',
    appVersion: 'local-first-2d',
    records: scenes.map((scene) => ({ schemaVersion: 1, data: scene.sceneJson })),
    mediaAssets,
  });
  await parsePiecePackage(bytes);
  return { bytes, missingAssets };
}
