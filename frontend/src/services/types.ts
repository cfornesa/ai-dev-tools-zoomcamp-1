/**
 * Task 214 (issue #246): one typed interface covering every function
 * currently exported from `../api/*.ts`, grouped by resource area the same
 * way the `api/` modules are already split. `RealServices`
 * (`./real.ts`) and `MockServices` (`./mock/index.ts`) both satisfy this
 * exact shape — everything downstream of `./index.ts` (the composition
 * point that picks one or the other) works identically either way.
 *
 * This is a pure re-grouping: every method signature here is copy-exact
 * from its `api/*.ts` source (see the doc comment on each for which file/
 * function it mirrors). No new behavior, types, or validation is
 * introduced at this layer.
 */
import type { CurrentUser } from '../api/auth';
import type { MistralCredentialStatus } from '../api/credentials';
import type { Template } from '../api/templates';
import type {
  ArtPieceLibrary,
  GenerateArtPieceResponse as ArtPieceGenerateResponse,
} from '../api/artPieces';
import type {
  DraftSyncPayload,
  DraftSyncResponse,
  DraftUpsertResponse,
  UpsertDraftSyncOptions,
} from '../api/drafts';
import type {
  Project,
  ProjectMetadataInput,
  SceneVersion,
  SceneVersionSummary,
  SaveSceneVersionInput,
  PublicGalleryPage,
  PublicProject,
} from '../api/projects';
import type { Project3D, SceneDocument3D, SceneVersion3D } from '../api/projects3d';
import type { AICreateSceneResponse, AIEditSceneResponse, AcceptAIProposalInput } from '../api/ai';
import type {
  AICreateScene3DResponse,
  AIEditScene3DResponse,
  AcceptAIProposal3DInput,
} from '../api/ai3d';

/** Mirrors `../api/auth.ts`. */
export interface AuthService {
  fetchCurrentUser(): Promise<CurrentUser | null>;
  logout(): Promise<void>;
}

/** Mirrors `../api/credentials.ts`. */
export interface CredentialsService {
  fetchMistralCredential(): Promise<MistralCredentialStatus>;
  saveMistralCredential(key: string): Promise<MistralCredentialStatus>;
  removeMistralCredential(): Promise<void>;
}

/** Mirrors `../api/templates.ts`. */
export interface TemplatesService {
  listTemplates(): Promise<Template[]>;
  cloneTemplate(id: string): Promise<Project>;
}

/** Mirrors `../api/artPieces.ts`. */
export interface ArtPiecesService {
  generateArtPiece(
    library: ArtPieceLibrary,
    prompt: string,
    signal?: AbortSignal,
    model?: string,
  ): Promise<ArtPieceGenerateResponse>;
}

/** Mirrors `../api/drafts.ts`. */
export interface DraftsService {
  readDraftSync(projectId: string, sessionId: string): Promise<DraftSyncResponse>;
  upsertDraftSync(
    projectId: string,
    sessionId: string,
    payload: DraftSyncPayload,
    options?: UpsertDraftSyncOptions,
  ): Promise<DraftUpsertResponse>;
  deleteDraftSync(projectId: string, sessionId: string): Promise<void>;
}

/** Mirrors `../api/projects.ts`. */
export interface ProjectsService {
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project>;
  updateProjectMetadata(id: string, data: ProjectMetadataInput): Promise<Project>;
  publishProject(id: string): Promise<Project>;
  unpublishProject(id: string): Promise<Project>;
  getSceneVersion(projectId: string, versionId: number): Promise<SceneVersion>;
  listSceneVersions(projectId: string): Promise<SceneVersionSummary[]>;
  saveSceneVersion(projectId: string, input: SaveSceneVersionInput): Promise<SceneVersion>;
  restoreSceneVersion(projectId: string, versionId: number): Promise<SceneVersion>;
  deleteSceneVersion(projectId: string, versionId: number): Promise<void>;
  listPublicGallery(options?: { cursor?: string; pageSize?: number }): Promise<PublicGalleryPage>;
  getPublicProject(id: string): Promise<PublicProject>;
  forkProject(id: string, clientRequestId?: string): Promise<Project>;
  createBlankProject(
    clientRequestId?: string,
    renderer?: 'p5' | 'canvas2d' | 'svg',
  ): Promise<Project>;
}

/** Mirrors `../api/projects3d.ts`. */
export interface Projects3DService {
  createProject3D(): Promise<Project3D>;
  listProjects3D(): Promise<Project3D[]>;
  getProject3D(id: string): Promise<Project3D>;
  deleteProject3D(id: string): Promise<void>;
  saveSceneVersion3D(projectId: string, sceneJson: SceneDocument3D): Promise<SceneVersion3D>;
}

/** Mirrors `../api/ai.ts`. */
export interface AIService {
  createAIScene(
    projectId: string,
    prompt: string,
    signal?: AbortSignal,
    model?: string,
  ): Promise<AICreateSceneResponse>;
  editAIScene(
    projectId: string,
    prompt: string,
    currentScene: Record<string, unknown>,
    baseVersionId: number | null,
    signal?: AbortSignal,
    model?: string,
  ): Promise<AIEditSceneResponse>;
  acceptAIProposal(
    projectId: string,
    input: AcceptAIProposalInput,
    signal?: AbortSignal,
  ): Promise<SceneVersion>;
}

/** Mirrors `../api/ai3d.ts`. */
export interface AI3DService {
  createAIScene3D(
    projectId: string,
    prompt: string,
    signal?: AbortSignal,
    model?: string,
  ): Promise<AICreateScene3DResponse>;
  editAIScene3D(
    projectId: string,
    prompt: string,
    currentScene: SceneDocument3D,
    baseVersionId: number | null,
    signal?: AbortSignal,
    model?: string,
  ): Promise<AIEditScene3DResponse>;
  acceptAIProposal3D(
    projectId: string,
    input: AcceptAIProposal3DInput,
    signal?: AbortSignal,
  ): Promise<SceneVersion3D>;
}

/** The full backend-services surface — one namespace per `api/*.ts` file.
 * `./real.ts` and `./mock/index.ts` each export a `BackendServices` that
 * satisfies this exact shape. */
export interface BackendServices {
  auth: AuthService;
  credentials: CredentialsService;
  templates: TemplatesService;
  artPieces: ArtPiecesService;
  drafts: DraftsService;
  projects: ProjectsService;
  projects3d: Projects3DService;
  ai: AIService;
  ai3d: AI3DService;
}
