import {
  getMediaBlob,
  getProject,
  listMediaAssetsForProject,
  listScenesForProject,
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
