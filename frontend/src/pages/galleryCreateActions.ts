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
import { createBlankProject } from '../api/projects';
import { createProject3D } from '../api/projects3d';

export type NewProjectRenderer = 'p5' | 'canvas2d' | 'svg';

export async function createNewAnimation(renderer: NewProjectRenderer): Promise<string> {
  const requestId = crypto.randomUUID();
  const project = await createBlankProject(requestId, renderer);
  return `/projects/${project.id}`;
}

export async function createAiAssistedAnimation(renderer: NewProjectRenderer): Promise<string> {
  const requestId = crypto.randomUUID();
  const project = await createBlankProject(requestId, renderer);
  return `/ai-projects/${project.id}`;
}

export async function createNew3DProject(): Promise<string> {
  const project = await createProject3D();
  return `/projects3d/${project.id}`;
}

export async function createAiAssisted3DProject(): Promise<string> {
  const project = await createProject3D();
  return `/ai-projects3d/${project.id}`;
}
