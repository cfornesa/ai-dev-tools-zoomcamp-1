import type { Page } from '@playwright/test';

type SceneSeed = { name: string; sceneJson: Record<string, unknown> };

type SeedInput = {
  ownerId: string;
  projectId: string;
  title: string;
  scene?: SceneSeed;
  media?: { filename: string; mimeType: string; bytes: number[] };
};

type CreateProjectInput = {
  ownerId: string;
  title: string;
  description?: string;
  kind?: '2d' | '3d' | 'generated';
  scene?: SceneSeed;
  thumbnail?: { mimeType: string; bytes: number[]; updatedAt: string };
};

type CreateProjectWithSceneInput = {
  ownerId: string;
  title: string;
  description?: string;
  kind?: '2d' | '3d' | 'generated';
  sceneName: string;
  sceneJson: Record<string, unknown>;
};

type OutboxRow = {
  projectId: string;
  state: string;
  sessionGeneration?: string;
  payload?: { type?: string };
  clientSequence?: number;
};

type TransferRow = {
  transferId: string;
  ownerId: string;
  projectId: string;
  assetId: string;
  byteLength: number;
  checksum: string;
  acknowledgedRanges: Array<{ start: number; end: number }>;
  state: 'pending' | 'uploading' | 'complete' | 'paused';
  lastErrorCode: string | null;
  chunkSize?: number;
  attemptCount?: number;
};

type DatabaseAction =
  | { kind: 'seed'; input: SeedInput }
  | { kind: 'create-project'; input: CreateProjectInput }
  | { kind: 'create-project-with-scene'; input: CreateProjectWithSceneInput }
  | { kind: 'read-project-content'; ownerId: string; projectId: string }
  | { kind: 'read-scenes'; projectId: string }
  | { kind: 'read-outbox'; projectId: string }
  | { kind: 'put-transfer'; record: TransferRow }
  | { kind: 'get-transfer'; transferId: string };

/** Run a fixture operation against the application's current IndexedDB schema.
 * The explicit store and stamp checks are stricter than the app opener, which
 * intentionally tolerates a missing schemaVersion stamp for legacy databases.
 */
export async function localProjectDb<T = unknown>(page: Page, action: DatabaseAction): Promise<T> {
  return page.evaluate(async (operation) => {
    const repository = (await new Function(
      'return import("/src/storage/localProjectRepository.ts")',
    )()) as {
      DB_VERSION: number;
      STORE_VERSIONS: string;
      openLocalProjectDatabase(): Promise<IDBDatabase>;
      ensureProject(
        db: IDBDatabase,
        input: { id: string; ownerId: string; title: string },
      ): Promise<unknown>;
      createScene(
        db: IDBDatabase,
        ownerId: string,
        input: { projectId: string; name: string; sceneJson: Record<string, unknown> },
      ): Promise<unknown>;
      createProject(
        db: IDBDatabase,
        input: {
          ownerId: string;
          title: string;
          description?: string;
          kind?: '2d' | '3d' | 'generated';
        },
      ): Promise<{ id: string }>;
      createProjectWithScene(
        db: IDBDatabase,
        input: {
          ownerId: string;
          title: string;
          description?: string;
          kind?: '2d' | '3d' | 'generated';
          sceneName: string;
          sceneJson: Record<string, unknown>;
        },
      ): Promise<{ project: { id: string } }>;
      getProject(
        db: IDBDatabase,
        ownerId: string,
        projectId: string,
      ): Promise<Record<string, unknown> | null>;
      listPieceVersions(
        db: IDBDatabase,
        ownerId: string,
        projectId: string,
      ): Promise<Array<{ sequence: number; payload: Record<string, unknown> }>>;
      updateProject(
        db: IDBDatabase,
        ownerId: string,
        projectId: string,
        patch: { thumbnail: Blob; thumbnailUpdatedAt: string },
      ): Promise<unknown>;
      importMediaAsset(
        db: IDBDatabase,
        input: {
          projectId: string;
          filename: string;
          mimeType: string;
          blob: Blob;
          altText: string;
        },
      ): Promise<{ id: string }>;
      listScenesForProject(db: IDBDatabase, projectId: string): Promise<unknown[]>;
    };
    const db = await repository.openLocalProjectDatabase();
    try {
      if (!db.objectStoreNames.contains(repository.STORE_VERSIONS)) {
        throw new Error('The application IndexedDB fixture is missing the versions store.');
      }
      const stamp = await new Promise<number | undefined>((resolve, reject) => {
        const request = db.transaction('meta', 'readonly').objectStore('meta').get('schemaVersion');
        request.onsuccess = () => resolve(request.result?.value as number | undefined);
        request.onerror = () => reject(request.error);
      });
      if (stamp !== repository.DB_VERSION) {
        throw new Error(
          `Expected schemaVersion ${repository.DB_VERSION}, received ${String(stamp)}.`,
        );
      }

      switch (operation.kind) {
        case 'create-project': {
          const { input } = operation;
          const project = await repository.createProject(db, {
            ownerId: input.ownerId,
            title: input.title,
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.kind === undefined ? {} : { kind: input.kind }),
          });
          if (input.scene) {
            await repository.createScene(db, input.ownerId, {
              projectId: project.id,
              name: input.scene.name,
              sceneJson: input.scene.sceneJson,
            });
          }
          if (input.thumbnail) {
            await repository.updateProject(db, input.ownerId, project.id, {
              thumbnail: new Blob([new Uint8Array(input.thumbnail.bytes)], {
                type: input.thumbnail.mimeType,
              }),
              thumbnailUpdatedAt: input.thumbnail.updatedAt,
            });
          }
          return { id: project.id };
        }
        case 'create-project-with-scene': {
          const { input } = operation;
          const created = await repository.createProjectWithScene(db, input);
          return { id: created.project.id };
        }
        case 'seed': {
          const { input } = operation;
          await repository.ensureProject(db, {
            id: input.projectId,
            ownerId: input.ownerId,
            title: input.title,
          });
          if (input.scene) {
            await repository.createScene(db, input.ownerId, {
              projectId: input.projectId,
              name: input.scene.name,
              sceneJson: input.scene.sceneJson,
            });
          }
          let assetId: string | undefined;
          if (input.media) {
            const asset = await repository.importMediaAsset(db, {
              projectId: input.projectId,
              filename: input.media.filename,
              mimeType: input.media.mimeType,
              blob: new Blob([new Uint8Array(input.media.bytes)], { type: input.media.mimeType }),
              altText: input.media.filename,
            });
            assetId = asset.id;
          }
          return { assetId };
        }
        case 'read-project-content':
          return {
            project: await repository.getProject(db, operation.ownerId, operation.projectId),
            scenes: await repository.listScenesForProject(db, operation.projectId),
            versions: await repository.listPieceVersions(
              db,
              operation.ownerId,
              operation.projectId,
            ),
          };
        case 'read-outbox': {
          const rows = await new Promise<OutboxRow[]>((resolve, reject) => {
            const request = db
              .transaction('mutationOutbox', 'readonly')
              .objectStore('mutationOutbox')
              .getAll();
            request.onsuccess = () => resolve(request.result as OutboxRow[]);
            request.onerror = () => reject(request.error);
          });
          return rows.filter((row) => row.projectId === operation.projectId);
        }
        case 'read-scenes':
          return await repository.listScenesForProject(db, operation.projectId);
        case 'put-transfer': {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('mediaTransfers', 'readwrite');
            tx.objectStore('mediaTransfers').put(operation.record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          return undefined;
        }
        case 'get-transfer':
          return await new Promise<TransferRow | undefined>((resolve, reject) => {
            const request = db
              .transaction('mediaTransfers', 'readonly')
              .objectStore('mediaTransfers')
              .get(operation.transferId);
            request.onsuccess = () => resolve(request.result as TransferRow | undefined);
            request.onerror = () => reject(request.error);
          });
      }
    } finally {
      db.close();
    }
  }, action) as Promise<T>;
}
