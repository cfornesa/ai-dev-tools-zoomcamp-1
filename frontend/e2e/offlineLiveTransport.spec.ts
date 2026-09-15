import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Authenticated offline-sync transport (#545)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`acknowledges and idempotently replays an owner mutation at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/account/settings/storage');

      const result = await page.evaluate(async (ownerId) => {
        const projectsApi = (await new Function('return import("/src/api/projects.ts")')()) as {
          createBlankProject(clientRequestId?: string): Promise<{ id: string }>;
          deleteProject(projectId: string): Promise<void>;
        };
        const repository = (await new Function(
          'return import("/src/storage/localProjectRepository.ts")',
        )()) as {
          openLocalProjectDatabase(): Promise<IDBDatabase>;
          ensureProject(
            db: IDBDatabase,
            input: { id: string; ownerId: string; title: string },
          ): Promise<unknown>;
          createScene(
            db: IDBDatabase,
            ownerId: string,
            input: { projectId: string; name: string; sceneJson: Record<string, unknown> },
          ): Promise<{ id: string }>;
        };
        const outbox = (await new Function(
          'return import("/src/storage/mutationOutbox.ts")',
        )()) as {
          enqueueMutation(
            db: IDBDatabase,
            input: {
              ownerId: string;
              projectId: string;
              sceneId: string;
              kind: 'scene';
              payload: Record<string, unknown>;
              sessionGeneration: string;
            },
          ): Promise<{
            operationId: string;
            clientSequence: number;
            payloadChecksum: string;
            schemaVersion: number;
            dependencyOperationIds: string[];
            createdAt: string;
            projectId: string;
            sceneId?: string;
            kind: 'scene';
            payload: unknown;
          }>;
        };
        const sync = (await new Function('return import("/src/api/syncMutations.ts")')()) as {
          sendSyncMutation(operation: unknown): Promise<{ replayed: boolean; acknowledged: true }>;
        };
        const sessions = (await new Function(
          'return import("/src/storage/mutationSession.ts")',
        )()) as { getMutationSessionGeneration(ownerId: string): string };

        const serverProject = await projectsApi.createBlankProject(crypto.randomUUID());
        const db = await repository.openLocalProjectDatabase();
        try {
          await repository.ensureProject(db, {
            id: serverProject.id,
            ownerId,
            title: 'Live transport fixture',
          });
          const scene = await repository.createScene(db, ownerId, {
            projectId: serverProject.id,
            name: 'Live transport scene',
            sceneJson: { objects: [] },
          });
          const operation = await outbox.enqueueMutation(db, {
            ownerId,
            projectId: serverProject.id,
            sceneId: scene.id,
            kind: 'scene',
            payload: { name: 'Live transport scene', scene_json: { objects: [] } },
            sessionGeneration: sessions.getMutationSessionGeneration(ownerId),
          });
          const first = await sync.sendSyncMutation(operation);
          const second = await sync.sendSyncMutation(operation);
          await projectsApi.deleteProject(serverProject.id);
          return { firstReplayed: first.replayed, secondReplayed: second.replayed };
        } finally {
          db.close();
        }
      }, fixtures.owner.username);

      expect(result).toEqual({ firstReplayed: false, secondReplayed: true });
    });
  }
});
