/**
 * Task 214 (issue #246): in-memory fixture data + mutable store backing
 * `./index.ts`'s mock `BackendServices`. Nothing here ever touches the
 * network, `localStorage`, or IndexedDB — state resets on every page
 * load/module re-import, which is the point: mock mode is for demoing and
 * developing the frontend with zero backend running, not for durable data.
 *
 * Shapes match `../../api/*.ts`'s real response types closely enough that
 * UI code exercising loading/error/success paths behaves the same as it
 * would against Django — see each exported constant/function's own
 * comment for the judgment calls made shaping it.
 */
import type { CurrentUser } from '../../api/auth';
import type { Project, SceneVersion, SceneVersionSummary } from '../../api/projects';
import type { Project3D } from '../../api/projects3d';
import type { Template } from '../../api/templates';

/** Task 214: the fixed "mock user" always considered signed in when
 * `VITE_USE_MOCK_BACKEND=true` — there is no real `/accounts/login/`
 * flow to stand in for in mock mode (that's server-rendered by Django,
 * out of this app's control; see AGENTS.md/the task's own scope note). */
export const MOCK_USER: CurrentUser = {
  username: 'mock_user',
  email: 'mock.user@example.com',
};

const now = new Date().toISOString();

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function blankSceneJson(renderer: 'p5' | 'canvas2d' | 'svg' = 'p5'): Record<string, unknown> {
  return {
    renderer: { preferred: renderer },
    canvas: { width: 800, height: 600, background: '#ffffff' },
    shapes: [],
  };
}

/** Mutable in-memory project store. Reassigned array reference on every
 * mutation (never spliced in place) so React state derived from a snapshot
 * of this module's exports stays predictable across mock calls in one
 * session. */
export const mockState = {
  nextProjectSeq: 3,
  nextVersionId: 100,
  nextVersion3DId: 200,
  projects: [
    {
      id: 'mock-project-1',
      owner: MOCK_USER.username,
      title: 'Bouncing Ball Study',
      description: 'A simple physics sketch used to demo the mock backend.',
      tags: ['demo', 'physics'],
      visibility: 'private',
      allow_public_remix: false,
      export_attribution: false,
      thumbnail_url: null,
      current_version: 1,
      current_version_origin: 'manual',
      created_at: isoMinutesAgo(120),
      updated_at: isoMinutesAgo(30),
    },
    {
      id: 'mock-project-2',
      owner: MOCK_USER.username,
      title: 'Generative Flowers',
      description: 'AI-created scene kept around to exercise the "AI" gallery badge.',
      tags: ['ai', 'generative'],
      visibility: 'public',
      allow_public_remix: true,
      export_attribution: true,
      thumbnail_url: null,
      current_version: 1,
      current_version_origin: 'ai_create',
      created_at: isoMinutesAgo(600),
      updated_at: isoMinutesAgo(600),
    },
  ] as Project[],
  /** projectId -> its versions, newest last (matches the real
   * `listSceneVersions` ordering contract). */
  versionsByProject: {
    'mock-project-1': [
      {
        id: 1,
        sequence: 1,
        origin: 'manual',
        change_label: 'Initial save',
        created_by: MOCK_USER.username,
        parent: null,
        fork_source_version: null,
        created_at: isoMinutesAgo(120),
        scene_json: blankSceneJson('p5'),
      },
    ] as SceneVersion[],
    'mock-project-2': [
      {
        id: 2,
        sequence: 1,
        origin: 'ai_create',
        change_label: null,
        created_by: MOCK_USER.username,
        parent: null,
        fork_source_version: null,
        created_at: isoMinutesAgo(600),
        scene_json: blankSceneJson('canvas2d'),
      },
    ] as SceneVersion[],
  } as Record<string, SceneVersion[]>,
  projects3d: [
    {
      id: 'mock-project3d-1',
      owner: MOCK_USER.username,
      visibility: 'private',
      title: 'Rotating Cube',
      thumbnail_url: null,
      current_version: {
        id: 201,
        sequence: 1,
        origin: 'manual',
        scene_json: { renderer: { preferred: 'threejs' }, objects: [] },
        created_by: MOCK_USER.username,
        created_at: isoMinutesAgo(90),
      },
      created_at: isoMinutesAgo(90),
      updated_at: isoMinutesAgo(90),
    },
  ] as Project3D[],
  templates: [
    {
      id: 'mock-template-1',
      source_type: 'built_in',
      owner: null,
      name: 'Starfield',
      category: 'Backgrounds',
      description: 'A twinkling starfield built for the p5 renderer.',
      created_at: now,
    },
    {
      id: 'mock-template-2',
      source_type: 'built_in',
      owner: null,
      name: 'Orbit Demo',
      category: '3D',
      description: 'Two spheres orbiting a central point.',
      created_at: now,
    },
  ] as Template[],
  mistralCredentialConfigured: false,
};

export function nextProjectId(prefix: 'mock-project' | 'mock-project3d'): string {
  const id = `${prefix}-${mockState.nextProjectSeq}`;
  mockState.nextProjectSeq += 1;
  return id;
}

export function nextVersionId(): number {
  const id = mockState.nextVersionId;
  mockState.nextVersionId += 1;
  return id;
}

export function nextVersion3DId(): number {
  const id = mockState.nextVersion3DId;
  mockState.nextVersion3DId += 1;
  return id;
}

export function toSummary(version: SceneVersion): SceneVersionSummary {
  const { scene_json: _scene_json, ...summary } = version;
  return summary;
}

export function findProject(id: string): Project | undefined {
  return mockState.projects.find((p) => p.id === id);
}

export function findProject3D(id: string): Project3D | undefined {
  return mockState.projects3d.find((p) => p.id === id);
}

export { blankSceneJson };
