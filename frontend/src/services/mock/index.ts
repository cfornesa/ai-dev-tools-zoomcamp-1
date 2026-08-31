/**
 * Task 214 (issue #246): the "mock" `BackendServices` implementation —
 * in-memory fixture data (`./fixtures.ts`), no network/localStorage/
 * IndexedDB access anywhere in this file. Selected by `../index.ts` when
 * `VITE_USE_MOCK_BACKEND=true`.
 *
 * Judgment calls, documented once here rather than repeated per method:
 *
 * - Sign-in: every method behaves as `MOCK_USER` (`./fixtures.ts`) is
 *   always signed in — there is no mock `/accounts/login/`, per the task's
 *   own scope (that flow is server-rendered by Django, outside this app).
 * - Deterministic error triggering: a handful of endpoints (the AI/art
 *   endpoints, whose real failure modes depend on the Mistral provider and
 *   can't be reproduced from pure input validation) recognize a
 *   `"trigger:<code>"` prefix on the `prompt` argument and throw the
 *   matching `ApiError` instead of succeeding — see `maybeTriggerError`
 *   below. This is a mock-only testing convenience with no equivalent on
 *   the real backend; every other method's error paths are driven by
 *   ordinary state (unknown id, blank required field, etc.), matching what
 *   Django would actually reject.
 * - Ownership/visibility checks mirror the real backend's "404, never 403,
 *   for anything not owned/visible to the caller" convention (see
 *   `openapi.yaml`'s per-operation `x-access: owner` operations and
 *   `../../api/projects.ts`'s own doc comments) so UI code branching on
 *   `ApiError.status` behaves the same against either backend.
 */
import { ApiError } from '../../api/client';
import type { CurrentUser } from '../../api/auth';
import type { Project, SceneVersion, PublicGalleryProject } from '../../api/projects';
import type { DraftSyncResponse } from '../../api/drafts';
import type { BackendServices } from '../types';
import {
  MOCK_USER,
  mockState,
  nextProjectId,
  nextVersionId,
  nextVersion3DId,
  toSummary,
  findProject,
  findProject3D,
  blankSceneJson,
} from './fixtures';

const AI_USAGE = {
  prompt_tokens: 128,
  completion_tokens: 256,
  total_tokens: 384,
  estimated_cost_usd: 0.002,
};

const TRIGGER_PREFIX = 'trigger:';

/** See this file's module doc comment ("Deterministic error triggering").
 * `defaultStatus` is used when the trigger code isn't one of the well-known
 * ones this mock recognizes. */
function maybeTriggerError(prompt: string): void {
  if (!prompt.startsWith(TRIGGER_PREFIX)) return;
  const code = prompt.slice(TRIGGER_PREFIX.length).trim() || 'provider_failure';
  const statusByCode: Record<string, number> = {
    prompt_invalid: 400,
    model_invalid: 400,
    rate_limited: 429,
    quota_exceeded: 402,
    provider_quota_exceeded: 402,
    timeout: 504,
    response_too_large: 413,
    provider_failure: 502,
    invalid_structured_output: 502,
    personal_key_required: 424,
  };
  const status = statusByCode[code] ?? 502;
  throw new ApiError(status, { error: code, detail: `Mock-triggered "${code}" error.` });
}

const draftStore = new Map<string, DraftSyncResponse & { applied: boolean }>();

function draftKey(projectId: string, sessionId: string): string {
  return `${projectId}:${sessionId}`;
}

function notFound(): never {
  throw new ApiError(404, { detail: 'Not found.' });
}

function toPublicGalleryProject(project: Project): PublicGalleryProject {
  return {
    id: project.id,
    title: project.title,
    owner: project.owner,
    thumbnail_url: project.thumbnail_url,
    remix_provenance: null,
    published_at: project.updated_at,
  };
}

function requireProject(id: string): Project {
  const project = findProject(id);
  if (!project) notFound();
  return project;
}

function currentVersion(project: Project): SceneVersion {
  const versions = mockState.versionsByProject[project.id] ?? [];
  const version = versions[versions.length - 1];
  if (!version) notFound();
  return version;
}

export const mockServices: BackendServices = {
  auth: {
    async fetchCurrentUser(): Promise<CurrentUser | null> {
      return MOCK_USER;
    },
    async logout(): Promise<void> {
      // No real session to invalidate in mock mode -- resolves as a no-op.
    },
  },

  credentials: {
    async fetchMistralCredential() {
      return { configured: mockState.mistralCredentialConfigured };
    },
    async saveMistralCredential(key: string) {
      if (!key.trim()) {
        throw new ApiError(400, { key: ['This field may not be blank.'] });
      }
      mockState.mistralCredentialConfigured = true;
      return { configured: true };
    },
    async removeMistralCredential(): Promise<void> {
      mockState.mistralCredentialConfigured = false;
    },
  },

  templates: {
    async listTemplates() {
      return mockState.templates;
    },
    async cloneTemplate(id: string): Promise<Project> {
      const template = mockState.templates.find((t) => t.id === id);
      if (!template) notFound();
      const projectId = nextProjectId('mock-project');
      const versionId = nextVersionId();
      const project: Project = {
        id: projectId,
        owner: MOCK_USER.username,
        title: `${template.name} (from template)`,
        description: template.description,
        tags: [],
        visibility: 'private',
        allow_public_remix: false,
        export_attribution: false,
        thumbnail_url: null,
        current_version: 1,
        current_version_origin: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockState.projects = [...mockState.projects, project];
      mockState.versionsByProject[projectId] = [
        {
          id: versionId,
          sequence: 1,
          origin: 'manual',
          change_label: 'Cloned from template',
          created_by: MOCK_USER.username,
          parent: null,
          fork_source_version: null,
          created_at: project.created_at,
          scene_json: blankSceneJson(),
        },
      ];
      return project;
    },
  },

  artPieces: {
    async generateArtPiece(library, prompt) {
      maybeTriggerError(prompt);
      if (!prompt.trim()) {
        throw new ApiError(400, { error: 'prompt_invalid', detail: 'Prompt must not be blank.' });
      }
      return {
        library,
        code:
          library === 'svg'
            ? '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="steelblue" /></svg>'
            : '// mock generated code\nfunction draw() {}',
        usage: AI_USAGE,
      };
    },
  },

  drafts: {
    async readDraftSync(projectId, sessionId) {
      const draft = draftStore.get(draftKey(projectId, sessionId));
      if (!draft) notFound();
      return draft;
    },
    async upsertDraftSync(projectId, sessionId, payload) {
      const response: DraftSyncResponse & { applied: boolean } = {
        draft_json: payload.draft_json,
        client_seq: payload.client_seq,
        last_autosaved_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        applied: true,
      };
      draftStore.set(draftKey(projectId, sessionId), response);
      return response;
    },
    async deleteDraftSync(projectId, sessionId): Promise<void> {
      draftStore.delete(draftKey(projectId, sessionId));
    },
  },

  projects: {
    async listProjects() {
      return mockState.projects;
    },
    async getProject(id) {
      return requireProject(id);
    },
    async updateProjectMetadata(id, data) {
      const project = requireProject(id);
      const updated: Project = { ...project, ...data, updated_at: new Date().toISOString() };
      mockState.projects = mockState.projects.map((p) => (p.id === id ? updated : p));
      return updated;
    },
    async publishProject(id) {
      const project = requireProject(id);
      if (!project.title.trim() || !project.description.trim()) {
        throw new ApiError(400, {
          errors: {
            ...(project.title.trim() ? {} : { title: ['Title is required to publish.'] }),
            ...(project.description.trim()
              ? {}
              : { description: ['Description is required to publish.'] }),
          },
        });
      }
      if (!project.current_version) {
        throw new ApiError(400, {
          errors: { current_version: ['Save at least one version before publishing.'] },
        });
      }
      const updated: Project = { ...project, visibility: 'public' };
      mockState.projects = mockState.projects.map((p) => (p.id === id ? updated : p));
      return updated;
    },
    async unpublishProject(id) {
      const project = requireProject(id);
      const updated: Project = { ...project, visibility: 'private' };
      mockState.projects = mockState.projects.map((p) => (p.id === id ? updated : p));
      return updated;
    },
    async getSceneVersion(projectId, versionId) {
      requireProject(projectId);
      const version = (mockState.versionsByProject[projectId] ?? []).find(
        (v) => v.id === versionId,
      );
      if (!version) notFound();
      return version;
    },
    async listSceneVersions(projectId) {
      requireProject(projectId);
      return (mockState.versionsByProject[projectId] ?? []).map(toSummary);
    },
    async saveSceneVersion(projectId, input) {
      const project = requireProject(projectId);
      const versions = mockState.versionsByProject[projectId] ?? [];
      const version: SceneVersion = {
        id: nextVersionId(),
        sequence: versions.length + 1,
        origin: input.origin,
        change_label: input.change_label ?? null,
        created_by: MOCK_USER.username,
        parent: versions[versions.length - 1]?.id ?? null,
        fork_source_version: null,
        created_at: new Date().toISOString(),
        scene_json: input.scene_json,
      };
      mockState.versionsByProject[projectId] = [...versions, version];
      mockState.projects = mockState.projects.map((p) =>
        p.id === projectId
          ? { ...p, current_version: version.sequence, updated_at: version.created_at }
          : p,
      );
      void project;
      return version;
    },
    async restoreSceneVersion(projectId, versionId) {
      requireProject(projectId);
      const versions = mockState.versionsByProject[projectId] ?? [];
      const source = versions.find((v) => v.id === versionId);
      if (!source) notFound();
      const restored: SceneVersion = {
        ...source,
        id: nextVersionId(),
        sequence: versions.length + 1,
        origin: 'restore',
        change_label: `Restored from version ${source.sequence}`,
        parent: versions[versions.length - 1]?.id ?? null,
        created_at: new Date().toISOString(),
      };
      mockState.versionsByProject[projectId] = [...versions, restored];
      mockState.projects = mockState.projects.map((p) =>
        p.id === projectId
          ? { ...p, current_version: restored.sequence, updated_at: restored.created_at }
          : p,
      );
      return restored;
    },
    async deleteSceneVersion(projectId, versionId): Promise<void> {
      const project = requireProject(projectId);
      const versions = mockState.versionsByProject[projectId] ?? [];
      const target = versions.find((v) => v.id === versionId);
      if (!target) notFound();
      if (target.sequence === project.current_version) {
        throw new ApiError(400, { detail: 'Cannot delete the current version.' });
      }
      mockState.versionsByProject[projectId] = versions.filter((v) => v.id !== versionId);
    },
    async listPublicGallery(options = {}) {
      const results = mockState.projects
        .filter((p) => p.visibility === 'public')
        .map(toPublicGalleryProject);
      void options;
      return { results, next_cursor: null, has_more: false };
    },
    async getPublicProject(id) {
      const project = requireProject(id);
      if (project.visibility !== 'public') notFound();
      const version = currentVersion(project);
      return {
        id: project.id,
        owner: project.owner,
        title: project.title,
        description: project.description,
        tags: project.tags,
        allow_public_remix: project.allow_public_remix,
        thumbnail_url: project.thumbnail_url,
        remix_provenance: null,
        current_version: {
          sequence: version.sequence,
          scene_json: version.scene_json,
          created_at: version.created_at,
        },
        created_at: project.created_at,
        updated_at: project.updated_at,
      };
    },
    async forkProject(id) {
      const source = requireProject(id);
      if (source.visibility !== 'public' || !source.allow_public_remix) notFound();
      const sourceVersion = currentVersion(source);
      const projectId = nextProjectId('mock-project');
      const versionId = nextVersionId();
      const forked: Project = {
        id: projectId,
        owner: MOCK_USER.username,
        title: `${source.title} (remix)`,
        description: source.description,
        tags: [...source.tags],
        visibility: 'private',
        allow_public_remix: false,
        export_attribution: false,
        thumbnail_url: null,
        current_version: 1,
        current_version_origin: 'fork',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockState.projects = [...mockState.projects, forked];
      mockState.versionsByProject[projectId] = [
        {
          id: versionId,
          sequence: 1,
          origin: 'fork',
          change_label: null,
          created_by: MOCK_USER.username,
          parent: null,
          fork_source_version: sourceVersion.id,
          created_at: forked.created_at,
          scene_json: sourceVersion.scene_json,
        },
      ];
      return forked;
    },
    async createBlankProject(_clientRequestId, renderer = 'p5') {
      const projectId = nextProjectId('mock-project');
      const versionId = nextVersionId();
      const project: Project = {
        id: projectId,
        owner: MOCK_USER.username,
        title: 'Untitled project',
        description: '',
        tags: [],
        visibility: 'private',
        allow_public_remix: false,
        export_attribution: false,
        thumbnail_url: null,
        current_version: 1,
        current_version_origin: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockState.projects = [...mockState.projects, project];
      mockState.versionsByProject[projectId] = [
        {
          id: versionId,
          sequence: 1,
          origin: 'manual',
          change_label: null,
          created_by: MOCK_USER.username,
          parent: null,
          fork_source_version: null,
          created_at: project.created_at,
          scene_json: blankSceneJson(renderer),
        },
      ];
      return project;
    },
  },

  projects3d: {
    async createProject3D() {
      const projectId = nextProjectId('mock-project3d');
      const versionId = nextVersion3DId();
      const project = {
        id: projectId,
        owner: MOCK_USER.username,
        visibility: 'private' as const,
        title: 'Untitled 3D project',
        thumbnail_url: null,
        current_version: {
          id: versionId,
          sequence: 1,
          origin: 'manual',
          scene_json: { renderer: { preferred: 'threejs' }, objects: [] },
          created_by: MOCK_USER.username,
          created_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockState.projects3d = [...mockState.projects3d, project];
      return project;
    },
    async listProjects3D() {
      return mockState.projects3d;
    },
    async getProject3D(id) {
      const project = findProject3D(id);
      if (!project) notFound();
      return project;
    },
    async deleteProject3D(id): Promise<void> {
      const project = findProject3D(id);
      if (!project) notFound();
      mockState.projects3d = mockState.projects3d.filter((p) => p.id !== id);
    },
    async saveSceneVersion3D(projectId, sceneJson) {
      const project = findProject3D(projectId);
      if (!project) notFound();
      const version = {
        id: nextVersion3DId(),
        sequence: (project.current_version?.sequence ?? 0) + 1,
        origin: 'manual',
        scene_json: sceneJson,
        created_by: MOCK_USER.username,
        created_at: new Date().toISOString(),
      };
      const updated = { ...project, current_version: version, updated_at: version.created_at };
      mockState.projects3d = mockState.projects3d.map((p) => (p.id === projectId ? updated : p));
      return version;
    },
  },

  ai: {
    async createAIScene(projectId, prompt) {
      requireProject(projectId);
      maybeTriggerError(prompt);
      if (!prompt.trim()) {
        throw new ApiError(400, { error: 'prompt_invalid', detail: 'Prompt must not be blank.' });
      }
      return {
        draft: true,
        operation: 'ai_create',
        scene: blankSceneJson(),
        usage: AI_USAGE,
      };
    },
    async editAIScene(projectId, prompt, currentScene) {
      requireProject(projectId);
      maybeTriggerError(prompt);
      if (!prompt.trim()) {
        throw new ApiError(400, { error: 'prompt_invalid', detail: 'Prompt must not be blank.' });
      }
      return {
        draft: true,
        operation: 'ai_edit',
        patch: [],
        scene: currentScene,
        change_summary: 'Mock edit applied (no-op).',
        usage: AI_USAGE,
      };
    },
    async acceptAIProposal(projectId, input) {
      const project = requireProject(projectId);
      const versions = mockState.versionsByProject[projectId] ?? [];
      const version: SceneVersion = {
        id: nextVersionId(),
        sequence: versions.length + 1,
        origin: input.operation,
        change_label: input.change_label ?? null,
        created_by: MOCK_USER.username,
        parent: versions[versions.length - 1]?.id ?? null,
        fork_source_version: null,
        created_at: new Date().toISOString(),
        scene_json: input.scene_json,
      };
      mockState.versionsByProject[projectId] = [...versions, version];
      mockState.projects = mockState.projects.map((p) =>
        p.id === projectId
          ? { ...p, current_version: version.sequence, updated_at: version.created_at }
          : p,
      );
      void project;
      return version;
    },
  },

  ai3d: {
    async createAIScene3D(projectId, prompt) {
      const project = findProject3D(projectId);
      if (!project) notFound();
      maybeTriggerError(prompt);
      if (!prompt.trim()) {
        throw new ApiError(400, { error: 'prompt_invalid', detail: 'Prompt must not be blank.' });
      }
      return {
        draft: true,
        operation: 'ai_create',
        scene: { renderer: { preferred: 'threejs' }, objects: [] },
        usage: AI_USAGE,
      };
    },
    async editAIScene3D(projectId, prompt, currentScene) {
      const project = findProject3D(projectId);
      if (!project) notFound();
      maybeTriggerError(prompt);
      if (!prompt.trim()) {
        throw new ApiError(400, { error: 'prompt_invalid', detail: 'Prompt must not be blank.' });
      }
      return {
        draft: true,
        operation: 'ai_edit',
        patch: [],
        scene: currentScene,
        change_summary: 'Mock 3D edit applied (no-op).',
        usage: AI_USAGE,
      };
    },
    async acceptAIProposal3D(projectId, input) {
      const project = findProject3D(projectId);
      if (!project) notFound();
      const version = {
        id: nextVersion3DId(),
        sequence: (project.current_version?.sequence ?? 0) + 1,
        origin: input.operation,
        scene_json: input.scene_json,
        created_by: MOCK_USER.username,
        created_at: new Date().toISOString(),
      };
      const updated = { ...project, current_version: version, updated_at: version.created_at };
      mockState.projects3d = mockState.projects3d.map((p) => (p.id === projectId ? updated : p));
      return version;
    },
  },
};
