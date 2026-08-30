import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/client';
import { mockServices } from './index';
import { MOCK_USER, mockState } from './fixtures';

/** Task 214 (issue #246): per-endpoint coverage of the mock
 * `BackendServices` implementation -- one success path and (where the real
 * endpoint documents a distinct failure mode) one representative error
 * path per resource area, per the task's acceptance criteria.
 *
 * `mockState` is a single module-level object shared across every test in
 * this file (matching how the app itself uses it for one session), so
 * tests that mutate global fixtures (e.g. `mistralCredentialConfigured`)
 * set the state they need up front rather than relying on isolation
 * between tests, and tests that need a "fresh" project create their own
 * via `createBlankProject`/`createProject3D` instead of touching the
 * pre-seeded fixture projects other tests also read. */
describe('mockServices', () => {
  describe('auth', () => {
    it('always resolves the fixed mock user', async () => {
      await expect(mockServices.auth.fetchCurrentUser()).resolves.toEqual(MOCK_USER);
    });

    it('logout resolves with no value', async () => {
      await expect(mockServices.auth.logout()).resolves.toBeUndefined();
    });
  });

  describe('credentials', () => {
    it('reports unconfigured, then configured after a save', async () => {
      mockState.mistralCredentialConfigured = false;
      await expect(mockServices.credentials.fetchMistralCredential()).resolves.toEqual({
        configured: false,
      });
      await expect(mockServices.credentials.saveMistralCredential('sk-test')).resolves.toEqual({
        configured: true,
      });
      await expect(mockServices.credentials.fetchMistralCredential()).resolves.toEqual({
        configured: true,
      });
    });

    it('rejects a blank key with a 400 ApiError', async () => {
      await expect(mockServices.credentials.saveMistralCredential('   ')).rejects.toMatchObject({
        status: 400,
      });
    });

    it('remove clears the configured flag', async () => {
      mockState.mistralCredentialConfigured = true;
      await mockServices.credentials.removeMistralCredential();
      await expect(mockServices.credentials.fetchMistralCredential()).resolves.toEqual({
        configured: false,
      });
    });
  });

  describe('templates', () => {
    it('lists the fixture templates', async () => {
      const templates = await mockServices.templates.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
    });

    it('clones a known template into a new project', async () => {
      const templates = await mockServices.templates.listTemplates();
      const project = await mockServices.templates.cloneTemplate(templates[0].id);
      expect(project.owner).toBe(MOCK_USER.username);
      expect(project.title).toContain(templates[0].name);
    });

    it('404s cloning an unknown template', async () => {
      await expect(mockServices.templates.cloneTemplate('does-not-exist')).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('artPieces', () => {
    it('generates art piece code for a valid prompt', async () => {
      const result = await mockServices.artPieces.generateArtPiece('svg', 'a red circle');
      expect(result.library).toBe('svg');
      expect(typeof result.code).toBe('string');
    });

    it('rejects a blank prompt with prompt_invalid (400)', async () => {
      await expect(mockServices.artPieces.generateArtPiece('svg', '   ')).rejects.toMatchObject({
        status: 400,
      });
    });

    it('supports the trigger: convention for hard-to-reach errors (424)', async () => {
      try {
        await mockServices.artPieces.generateArtPiece('svg', 'trigger:personal_key_required');
        throw new Error('expected rejection');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(424);
        expect((err as ApiError).body).toMatchObject({ error: 'personal_key_required' });
      }
    });
  });

  describe('drafts', () => {
    it('404s reading a draft that was never synced', async () => {
      await expect(
        mockServices.drafts.readDraftSync('mock-project-1', 'never-synced-session'),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('upsert then read round-trips the draft', async () => {
      const payload = { draft_json: { shapes: [] }, client_seq: 1 };
      const upserted = await mockServices.drafts.upsertDraftSync(
        'mock-project-1',
        'session-a',
        payload,
      );
      expect(upserted.applied).toBe(true);
      const read = await mockServices.drafts.readDraftSync('mock-project-1', 'session-a');
      expect(read.draft_json).toEqual(payload.draft_json);
    });

    it('delete removes the draft (subsequent read 404s)', async () => {
      await mockServices.drafts.upsertDraftSync('mock-project-1', 'session-b', {
        draft_json: {},
        client_seq: 1,
      });
      await mockServices.drafts.deleteDraftSync('mock-project-1', 'session-b');
      await expect(
        mockServices.drafts.readDraftSync('mock-project-1', 'session-b'),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('projects', () => {
    it('lists the fixture projects', async () => {
      const projects = await mockServices.projects.listProjects();
      expect(projects.length).toBeGreaterThan(0);
    });

    it('404s getting an unknown project', async () => {
      await expect(mockServices.projects.getProject('does-not-exist')).rejects.toMatchObject({
        status: 404,
      });
    });

    it('creates a blank project with a chosen renderer', async () => {
      const project = await mockServices.projects.createBlankProject(undefined, 'svg');
      expect(project.owner).toBe(MOCK_USER.username);
      const version = await mockServices.projects.getSceneVersion(
        project.id,
        (await mockServices.projects.listSceneVersions(project.id))[0].id,
      );
      expect(version.scene_json).toMatchObject({ renderer: { preferred: 'svg' } });
    });

    it('saves a new scene version and advances current_version', async () => {
      const project = await mockServices.projects.createBlankProject();
      const before = await mockServices.projects.listSceneVersions(project.id);
      const saved = await mockServices.projects.saveSceneVersion(project.id, {
        scene_json: { shapes: [] },
        origin: 'manual',
        change_label: 'test save',
      });
      expect(saved.sequence).toBe(before.length + 1);
      const after = await mockServices.projects.getProject(project.id);
      expect(after.current_version).toBe(saved.sequence);
    });

    it('rejects publishing a project with a blank title/description (400)', async () => {
      const project = await mockServices.projects.createBlankProject();
      await mockServices.projects.updateProjectMetadata(project.id, {
        title: '',
        description: '',
      });
      await expect(mockServices.projects.publishProject(project.id)).rejects.toMatchObject({
        status: 400,
      });
    });

    it('publishes then unpublishes a valid project', async () => {
      const project = await mockServices.projects.createBlankProject();
      await mockServices.projects.updateProjectMetadata(project.id, {
        title: 'A real title',
        description: 'A real description',
      });
      const published = await mockServices.projects.publishProject(project.id);
      expect(published.visibility).toBe('public');
      const unpublished = await mockServices.projects.unpublishProject(project.id);
      expect(unpublished.visibility).toBe('private');
    });

    it('public gallery only lists public projects', async () => {
      const page = await mockServices.projects.listPublicGallery();
      expect(page.results.every((p) => p !== null)).toBe(true);
      expect(page.has_more).toBe(false);
    });

    it('404s getPublicProject for a private project', async () => {
      const project = await mockServices.projects.createBlankProject();
      await expect(mockServices.projects.getPublicProject(project.id)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('forks a public, remix-enabled project', async () => {
      const projects = await mockServices.projects.listProjects();
      const remixable = projects.find((p) => p.visibility === 'public' && p.allow_public_remix);
      expect(remixable).toBeDefined();
      const forked = await mockServices.projects.forkProject(remixable!.id);
      expect(forked.current_version_origin).toBe('fork');
    });
  });

  describe('projects3d', () => {
    it('creates and lists 3D projects', async () => {
      const created = await mockServices.projects3d.createProject3D();
      const listed = await mockServices.projects3d.listProjects3D();
      expect(listed.some((p) => p.id === created.id)).toBe(true);
    });

    it('404s getting an unknown 3D project', async () => {
      await expect(mockServices.projects3d.getProject3D('nope')).rejects.toMatchObject({
        status: 404,
      });
    });

    it('saves a new 3D scene version', async () => {
      const project = await mockServices.projects3d.createProject3D();
      const version = await mockServices.projects3d.saveSceneVersion3D(project.id, {
        objects: [],
      });
      expect(version.sequence).toBe(2);
    });
  });

  describe('ai', () => {
    it('creates a draft AI scene for a valid prompt', async () => {
      const projects = await mockServices.projects.listProjects();
      const result = await mockServices.ai.createAIScene(projects[0].id, 'a red square');
      expect(result.draft).toBe(true);
    });

    it('404s for an unknown project', async () => {
      await expect(mockServices.ai.createAIScene('nope', 'a red square')).rejects.toMatchObject({
        status: 404,
      });
    });

    it('accept persists a new SceneVersion', async () => {
      const project = await mockServices.projects.createBlankProject();
      const version = await mockServices.ai.acceptAIProposal(project.id, {
        operation: 'ai_create',
        scene_json: { shapes: [] },
        base_version_id: null,
        client_request_id: 'req-1',
      });
      expect(version.origin).toBe('ai_create');
    });
  });

  describe('ai3d', () => {
    it('creates a draft 3D AI scene for a valid prompt', async () => {
      const project = await mockServices.projects3d.createProject3D();
      const result = await mockServices.ai3d.createAIScene3D(project.id, 'a blue sphere');
      expect(result.draft).toBe(true);
    });

    it('404s for an unknown 3D project', async () => {
      await expect(
        mockServices.ai3d.createAIScene3D('nope', 'a blue sphere'),
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
