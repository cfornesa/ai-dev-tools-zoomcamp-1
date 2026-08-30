/**
 * Task 214 (issue #246): the "real" `BackendServices` implementation — a
 * thin pass-through to the existing `../api/*.ts` functions. No behavior
 * change versus calling those functions directly: every method here is a
 * one-line forward, so real API calls (URL, method, body, error handling)
 * are exactly what they were before this layer existed.
 */
import * as auth from '../api/auth';
import * as credentials from '../api/credentials';
import * as templates from '../api/templates';
import * as artPieces from '../api/artPieces';
import * as drafts from '../api/drafts';
import * as projects from '../api/projects';
import * as projects3d from '../api/projects3d';
import * as ai from '../api/ai';
import * as ai3d from '../api/ai3d';
import type { BackendServices } from './types';

export const realServices: BackendServices = {
  auth: {
    fetchCurrentUser: auth.fetchCurrentUser,
    logout: auth.logout,
  },
  credentials: {
    fetchMistralCredential: credentials.fetchMistralCredential,
    saveMistralCredential: credentials.saveMistralCredential,
    removeMistralCredential: credentials.removeMistralCredential,
  },
  templates: {
    listTemplates: templates.listTemplates,
    cloneTemplate: templates.cloneTemplate,
  },
  artPieces: {
    generateArtPiece: artPieces.generateArtPiece,
  },
  drafts: {
    readDraftSync: drafts.readDraftSync,
    upsertDraftSync: drafts.upsertDraftSync,
    deleteDraftSync: drafts.deleteDraftSync,
  },
  projects: {
    listProjects: projects.listProjects,
    getProject: projects.getProject,
    updateProjectMetadata: projects.updateProjectMetadata,
    publishProject: projects.publishProject,
    unpublishProject: projects.unpublishProject,
    getSceneVersion: projects.getSceneVersion,
    listSceneVersions: projects.listSceneVersions,
    saveSceneVersion: projects.saveSceneVersion,
    restoreSceneVersion: projects.restoreSceneVersion,
    deleteSceneVersion: projects.deleteSceneVersion,
    listPublicGallery: projects.listPublicGallery,
    getPublicProject: projects.getPublicProject,
    forkProject: projects.forkProject,
    createBlankProject: projects.createBlankProject,
  },
  projects3d: {
    createProject3D: projects3d.createProject3D,
    listProjects3D: projects3d.listProjects3D,
    getProject3D: projects3d.getProject3D,
    deleteProject3D: projects3d.deleteProject3D,
    saveSceneVersion3D: projects3d.saveSceneVersion3D,
  },
  ai: {
    createAIScene: ai.createAIScene,
    editAIScene: ai.editAIScene,
    acceptAIProposal: ai.acceptAIProposal,
  },
  ai3d: {
    createAIScene3D: ai3d.createAIScene3D,
    editAIScene3D: ai3d.editAIScene3D,
    acceptAIProposal3D: ai3d.acceptAIProposal3D,
  },
};
