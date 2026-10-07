/**
 * Shared local-first creation calls for the gallery menu, chooser and
 * template flow. Callers pass the authenticated username so new browser
 * records use the same owner key as the Studio and local editors.
 */
import { getTemplate } from '../api/templates';
import { createBlankProject as createApiBlankProject } from '../api/projects';
import { createProject3D as createApiProject3D } from '../api/projects3d';
import { ART_PIECE_ENGINE_CAPABILITIES, type ArtPieceLibrary } from '../api/artPieces';
import { getArtPieceStarter } from '../generative/artPieceStarters';
import {
  createProject,
  createProjectWithScene,
  createScene,
  createLocal3DProject,
  openLocalProjectDatabase,
  createLocalGeneratedProject,
} from '../storage/localProjectRepository';

export type NewProjectRenderer = 'p5' | 'canvas2d' | 'svg';
export type CreationMode = 'blank' | 'ai';

function editorRoute(editorUrl: string | null | undefined, mode: CreationMode): string {
  if (!editorUrl) throw new Error('The new project has no canonical editor route.');
  const destination = new URL(editorUrl, window.location.origin);
  if (mode === 'ai') destination.searchParams.set('start', 'ai');
  return `${destination.pathname}${destination.search}${destination.hash}`;
}

/** Issue #1276: create structured 2D work through the server model so blank
 * and AI starts share the same canonical editor, save and publish controls. */
export async function createChooser2DProject(
  ownerId: string,
  renderer: NewProjectRenderer,
  mode: CreationMode,
): Promise<string> {
  if (!ownerId) throw new Error('A signed-in account is required to create a project.');
  const project = await createApiBlankProject(undefined, renderer);
  return editorRoute(project.editor_url, mode);
}

/** Issue #1276: 3D blank and AI starts share the canonical server editor. */
export async function createChooser3DProject(ownerId: string, mode: CreationMode): Promise<string> {
  if (!ownerId) throw new Error('A signed-in account is required to create a project.');
  const project = await createApiProject3D();
  return editorRoute(project.editor_url, mode);
}

export function getGeneratedArtPieceStartPath(
  library: ArtPieceLibrary,
  mode: CreationMode,
): string {
  const params = new URLSearchParams({ engine: library });
  if (mode === 'blank') params.set('mode', 'blank');
  return `/art-pieces?${params.toString()}`;
}

export async function createNewAnimation(
  ownerId: string,
  renderer: NewProjectRenderer,
): Promise<string> {
  if (!ownerId) throw new Error('A signed-in account is required for local projects.');
  const db = await openLocalProjectDatabase();
  try {
    const project = await createProject(db, {
      ownerId,
      title: 'Untitled animation',
      kind: '2d',
    });
    await createScene(db, ownerId, {
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

export async function createAiAssistedAnimation(
  ownerId: string,
  renderer: NewProjectRenderer,
): Promise<string> {
  return createNewAnimation(ownerId, renderer);
}

export async function createLocalTemplate(ownerId: string, templateId: string): Promise<string> {
  if (!ownerId) throw new Error('A signed-in account is required for local projects.');
  const template = await getTemplate(templateId);
  const db = await openLocalProjectDatabase();
  try {
    const sceneJson = structuredClone(template.scene_json);
    sceneJson.id = crypto.randomUUID();
    const { project } = await createProjectWithScene(db, {
      ownerId,
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

export async function createNew3DProject(ownerId: string): Promise<string> {
  if (!ownerId) throw new Error('A signed-in account is required for local projects.');
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
      ownerId,
      title: 'Untitled 3D scene',
      sceneJson: scene,
    });
    return `/local-projects/${project.id}`;
  } finally {
    db.close();
  }
}

export async function createAiAssisted3DProject(ownerId: string): Promise<string> {
  return createNew3DProject(ownerId);
}

export async function createLocalGeneratedPiece(
  ownerId: string,
  library: ArtPieceLibrary = 'svg',
): Promise<string> {
  if (!ownerId) throw new Error('A signed-in account is required for local projects.');
  const db = await openLocalProjectDatabase();
  try {
    const { project } = await createLocalGeneratedProject(db, {
      ownerId,
      title:
        library === 'svg'
          ? 'Local generated SVG'
          : `Local ${ART_PIECE_ENGINE_CAPABILITIES[library].label} starter`,
      description: `A local-only ${ART_PIECE_ENGINE_CAPABILITIES[library].label} starter. Edit the source and save versions without server transfer.`,
      engine: library,
      source: getArtPieceStarter(library),
    });
    return `/local-generated/${project.id}`;
  } finally {
    db.close();
  }
}
