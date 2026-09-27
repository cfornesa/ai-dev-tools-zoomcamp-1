/**
 * Issue #268: the 4 project-creation calls shared by the gallery header's
 * split-button dropdown and the full "/create" chooser page, so neither
 * duplicates `createBlankProject`/`createProject3D` request-building or
 * destination-route logic. Each function performs the exact same API call
 * and returns the exact same destination route `Gallery.tsx`'s pre-#268
 * `handleCreate`/`handleCreateAiAssisted`/`handleCreate3D`/
 * `handleCreate3DAiAssisted` navigated to -- a pure extraction, not a
 * behavior change.
 */
import { getTemplate } from '../api/templates';
import { fetchProfile } from '../api/profile';
import {
  createProject,
  createProjectWithScene,
  createScene,
  createLocal3DProject,
  openLocalProjectDatabase,
  createLocalGeneratedProject,
} from '../storage/localProjectRepository';

export type NewProjectRenderer = 'p5' | 'canvas2d' | 'svg';

export async function createNewAnimation(renderer: NewProjectRenderer): Promise<string> {
  const profile = await fetchProfile();
  if (!profile.handle) throw new Error('A signed-in profile is required for local projects.');
  const db = await openLocalProjectDatabase();
  try {
    const project = await createProject(db, {
      ownerId: profile.handle,
      title: 'Untitled animation',
      kind: '2d',
    });
    await createScene(db, profile.handle, {
      projectId: project.id,
      name: 'Scene 1',
      sceneJson: {
        schemaVersion: 1,
        id: crypto.randomUUID(),
        canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
        renderer: { preferred: renderer },
        layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
        shapes: [],
        groups: [],
        bindings: [],
        graph: { nodes: [], connections: [] },
        accessibility: { reducedMotion: 'auto' },
        randomness: { seed: 0, enabled: false },
      },
    });
    return `/local-projects/${project.id}`;
  } finally {
    db.close();
  }
}

export async function createAiAssistedAnimation(renderer: NewProjectRenderer): Promise<string> {
  return createNewAnimation(renderer);
}

export async function createLocalTemplate(templateId: string): Promise<string> {
  const profile = await fetchProfile();
  if (!profile.handle) throw new Error('A signed-in profile is required for local projects.');
  const template = await getTemplate(templateId);
  const db = await openLocalProjectDatabase();
  try {
    const sceneJson = structuredClone(template.scene_json);
    sceneJson.id = crypto.randomUUID();
    const { project } = await createProjectWithScene(db, {
      ownerId: profile.handle,
      title: template.name,
      kind: '2d',
      sceneName: 'Scene 1',
      sceneJson,
    });
    return `/local-projects/${project.id}`;
  } finally {
    db.close();
  }
}

export async function createNew3DProject(): Promise<string> {
  const profile = await fetchProfile();
  if (!profile.handle) throw new Error('A signed-in profile is required for local projects.');
  const db = await openLocalProjectDatabase();
  try {
    const scene = {
      schemaVersion: 1,
      documentType: 'scene3d',
      id: `scene3d-${crypto.randomUUID()}`,
      scene: { backgroundColor: '#808080' },
      camera: {
        position: { x: 0, y: 5, z: 10 },
        target: { x: 0, y: 0, z: 0 },
        fov: 50,
        near: 0.1,
        far: 1000,
      },
      lights: [],
      groups: [],
      objects: [],
      randomness: { seed: 0, enabled: false },
      renderer: { preferred: 'threejs' },
    } satisfies Record<string, unknown>;
    const { project } = await createLocal3DProject(db, {
      ownerId: profile.handle,
      title: 'Untitled 3D scene',
      sceneJson: scene,
    });
    return `/local-projects/${project.id}`;
  } finally {
    db.close();
  }
}

export async function createAiAssisted3DProject(): Promise<string> {
  return createNew3DProject();
}

export async function createLocalGeneratedPiece(): Promise<string> {
  const profile = await fetchProfile();
  if (!profile.handle) throw new Error('A signed-in profile is required for local projects.');
  const db = await openLocalProjectDatabase();
  try {
    const { project } = await createLocalGeneratedProject(db, {
      ownerId: profile.handle,
      title: 'Local generated SVG',
      description:
        'A local-only generated piece. Edit the source and save versions without server transfer.',
      engine: 'svg',
      source:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#101827"/><circle cx="400" cy="300" r="120" fill="#35c6dc"/></svg>',
    });
    return `/local-generated/${project.id}`;
  } finally {
    db.close();
  }
}
