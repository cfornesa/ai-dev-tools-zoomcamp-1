import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { apiDelete, apiGet, apiPost } from './support/api.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(',')}}`;
}

async function checksum(page: Page, payload: unknown): Promise<string> {
  return page.evaluate(async (input) => {
    const canonical = (value: unknown): string => {
      if (value === null || typeof value !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
        .join(',')}}`;
    };
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(canonical(input)),
    );
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  }, payload);
}

test.describe('Live authenticated conflict resolution (#544)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`creates and replays a server-authoritative resolution at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);

      const projectResponse = await apiPost(page.context(), '/api/projects/blank/');
      expect(projectResponse.status()).toBe(201);
      const project = (await projectResponse.json()) as {
        id: string;
        current_version: number;
        active_scene: string;
      };
      try {
        const versionResponse = await apiGet(
          page.context(),
          `/api/projects/${project.id}/versions/${project.current_version}/`,
        );
        expect(versionResponse.status()).toBe(200);
        const version = (await versionResponse.json()) as { scene_json: Record<string, unknown> };
        const resolvedPayload = {
          ...version.scene_json,
          canvas: {
            ...(version.scene_json.canvas as Record<string, unknown>),
            backgroundColor: '#ffeeaa',
          },
        };
        const resolutionPayload = {
          type: 'conflict-resolution',
          base_version: String(project.current_version),
          choice: 'compose',
          resolved_payload: resolvedPayload,
          audit: {
            conflict_paths: ['canvas.backgroundColor'],
            local_operation_ids: ['live-local-544'],
            remote_operation_ids: ['live-remote-544'],
          },
        };
        const operationId = await page.evaluate(() => crypto.randomUUID());
        const operation = {
          project_id: project.id,
          scene_id: project.active_scene,
          operation_id: operationId,
          client_sequence: 1,
          kind: 'scene',
          payload: resolutionPayload,
          payload_checksum: await checksum(page, resolutionPayload),
          schema_version: 1,
          dependency_operation_ids: [],
          client_created_at: new Date().toISOString(),
        };

        const first = await apiPost(
          page.context(),
          `/api/projects/${project.id}/sync/mutations/`,
          operation,
        );
        expect(first.status(), await first.text()).toBe(201);
        const firstBody = (await first.json()) as { applied_scene_version_id: number };
        expect(firstBody.applied_scene_version_id).toBeGreaterThan(project.current_version);

        const replay = await apiPost(
          page.context(),
          `/api/projects/${project.id}/sync/mutations/`,
          operation,
        );
        expect(replay.status()).toBe(200);
        expect((await replay.json()).applied_scene_version_id).toBe(
          firstBody.applied_scene_version_id,
        );

        const newerPayload = {
          ...resolvedPayload,
          canvas: {
            ...(resolvedPayload.canvas as Record<string, unknown>),
            backgroundColor: '#aaffee',
          },
        };
        const newerVersion = await apiPost(
          page.context(),
          `/api/projects/${project.id}/versions/`,
          {
            scene_json: newerPayload,
            origin: 'manual',
            change_label: 'live stale-base fixture',
          },
        );
        expect(newerVersion.status()).toBe(201);

        const stalePayload = {
          ...resolutionPayload,
          choice: 'keep-local',
          resolved_payload: {
            ...resolvedPayload,
            canvas: {
              ...(resolvedPayload.canvas as Record<string, unknown>),
              backgroundColor: '#ffaaaa',
            },
          },
        };
        const stale = await apiPost(page.context(), `/api/projects/${project.id}/sync/mutations/`, {
          ...operation,
          operation_id: await page.evaluate(() => crypto.randomUUID()),
          client_sequence: 2,
          payload: stalePayload,
          payload_checksum: await checksum(page, stalePayload),
        });
        expect(stale.status()).toBe(409);
        const staleBody = (await stale.json()) as {
          error: string;
          conflict: { remoteSnapshot: { canvas: { backgroundColor: string } } };
        };
        expect(staleBody).toMatchObject({
          error: 'conflict',
          conflict: { remoteSnapshot: { canvas: { backgroundColor: '#aaffee' } } },
        });

        // Keep the helper's canonicalizer exercised in the test source itself;
        // it documents the exact checksum contract beside the live fixture.
        expect(canonicalJson(resolutionPayload)).toContain('conflict-resolution');
      } finally {
        const deleted = await apiDelete(page.context(), `/api/projects/${project.id}/`);
        expect([200, 204]).toContain(deleted.status());
      }
    });
  }
});
