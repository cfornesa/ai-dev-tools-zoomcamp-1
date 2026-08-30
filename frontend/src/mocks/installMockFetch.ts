/**
 * Task 214 (issue #246): a global `fetch` shim that routes every
 * `/api/*` and `/accounts/logout/` request to `../services/mock`
 * (`mockServices`) instead of a real network call, translating each
 * mock-service call's resolved value/thrown `ApiError` back into a real
 * `Response` object.
 *
 * Why intercept at the `fetch` level rather than have pages/components
 * import `../services` directly: `../api/*.ts` (and everything that calls
 * it — every existing page/component, and the ~65 existing test files'
 * `vi.mock('../api/...')` calls) is explicitly out of scope to rewrite
 * for this task. Patching `fetch` once, at the app's composition root
 * (`../main.tsx`), means `../api/client.ts`'s `apiFetch` keeps behaving
 * exactly as written — same CSRF header logic, same 204/JSON parsing,
 * same `ApiError` — while transparently talking to the mock instead of
 * Django when `VITE_USE_MOCK_BACKEND=true`. This is installed nowhere
 * else, and never in test files, so it has no effect on any existing
 * test's `vi.mock('../api/...')` behavior.
 */
import { ApiError } from '../api/client';
import { mockServices } from '../services/mock';

type RouteHandler = (
  params: Record<string, string>,
  body: unknown,
  search: URLSearchParams,
) => Promise<unknown>;

type Route = {
  method: string;
  // Named groups become `params`.
  pattern: RegExp;
  handler: RouteHandler;
  /** true for endpoints that resolve with no body (204 No Content), matching
   * the real endpoint's response per openapi.yaml. */
  noContent?: boolean;
};

const routes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/whoami\/$/,
    handler: () => mockServices.auth.fetchCurrentUser(),
  },
  {
    method: 'POST',
    pattern: /^\/accounts\/logout\/$/,
    handler: () => mockServices.auth.logout(),
    noContent: true,
  },
  {
    method: 'GET',
    pattern: /^\/api\/account\/mistral-credential\/$/,
    handler: () => mockServices.credentials.fetchMistralCredential(),
  },
  {
    method: 'PUT',
    pattern: /^\/api\/account\/mistral-credential\/$/,
    handler: (_p, body) =>
      mockServices.credentials.saveMistralCredential((body as { key: string }).key),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/account\/mistral-credential\/$/,
    handler: () => mockServices.credentials.removeMistralCredential(),
    noContent: true,
  },
  {
    method: 'GET',
    pattern: /^\/api\/templates\/$/,
    handler: () => mockServices.templates.listTemplates(),
  },
  {
    method: 'POST',
    pattern: /^\/api\/templates\/(?<id>[^/]+)\/clone\/$/,
    handler: (p) => mockServices.templates.cloneTemplate(p.id),
  },
  {
    method: 'POST',
    pattern: /^\/api\/ai\/art-pieces\/generate\/$/,
    handler: (_p, body) => {
      const b = body as {
        library: 'canvas2d' | 'svg' | 'threejs' | 'aframe';
        prompt: string;
        model?: string;
      };
      return mockServices.artPieces.generateArtPiece(b.library, b.prompt, undefined, b.model);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/projects\/(?<projectId>[^/]+)\/draft\/(?<sessionId>[^/]+)\/$/,
    handler: (p) => mockServices.drafts.readDraftSync(p.projectId, decodeURIComponent(p.sessionId)),
  },
  {
    method: 'PUT',
    pattern: /^\/api\/projects\/(?<projectId>[^/]+)\/draft\/(?<sessionId>[^/]+)\/$/,
    handler: (p, body) =>
      mockServices.drafts.upsertDraftSync(
        p.projectId,
        decodeURIComponent(p.sessionId),
        body as never,
      ),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/projects\/(?<projectId>[^/]+)\/draft\/(?<sessionId>[^/]+)\/$/,
    handler: (p) =>
      mockServices.drafts.deleteDraftSync(p.projectId, decodeURIComponent(p.sessionId)),
    noContent: true,
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects\/blank\/$/,
    handler: (_p, body) => {
      const b =
        (body as { client_request_id?: string; renderer?: 'p5' | 'canvas2d' | 'svg' }) ?? {};
      return mockServices.projects.createBlankProject(b.client_request_id, b.renderer);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/projects\/$/,
    handler: () => mockServices.projects.listProjects(),
  },
  {
    method: 'GET',
    pattern: /^\/api\/projects\/(?<id>[^/]+)\/$/,
    handler: (p) => mockServices.projects.getProject(p.id),
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/projects\/(?<id>[^/]+)\/$/,
    handler: (p, body) => mockServices.projects.updateProjectMetadata(p.id, body as never),
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects\/(?<id>[^/]+)\/publish\/$/,
    handler: (p) => mockServices.projects.publishProject(p.id),
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects\/(?<id>[^/]+)\/unpublish\/$/,
    handler: (p) => mockServices.projects.unpublishProject(p.id),
  },
  {
    method: 'GET',
    pattern: /^\/api\/projects\/(?<projectId>[^/]+)\/versions\/(?<versionId>\d+)\/$/,
    handler: (p) => mockServices.projects.getSceneVersion(p.projectId, Number(p.versionId)),
  },
  {
    method: 'GET',
    pattern: /^\/api\/projects\/(?<projectId>[^/]+)\/versions\/$/,
    handler: (p) => mockServices.projects.listSceneVersions(p.projectId),
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects\/(?<projectId>[^/]+)\/versions\/$/,
    handler: (p, body) => mockServices.projects.saveSceneVersion(p.projectId, body as never),
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects\/(?<projectId>[^/]+)\/versions\/(?<versionId>\d+)\/restore\/$/,
    handler: (p) => mockServices.projects.restoreSceneVersion(p.projectId, Number(p.versionId)),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/projects\/(?<projectId>[^/]+)\/versions\/(?<versionId>\d+)\/$/,
    handler: (p) => mockServices.projects.deleteSceneVersion(p.projectId, Number(p.versionId)),
    noContent: true,
  },
  {
    method: 'GET',
    pattern: /^\/api\/public\/projects\/$/,
    handler: (_p, _b, search) =>
      mockServices.projects.listPublicGallery({
        cursor: search.get('cursor') ?? undefined,
        pageSize: search.get('page_size') ? Number(search.get('page_size')) : undefined,
      }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/public\/projects\/(?<id>[^/]+)\/$/,
    handler: (p) => mockServices.projects.getPublicProject(p.id),
  },
  {
    method: 'POST',
    pattern: /^\/api\/public\/projects\/(?<id>[^/]+)\/fork\/$/,
    handler: (p, body) =>
      mockServices.projects.forkProject(
        p.id,
        (body as { client_request_id?: string })?.client_request_id,
      ),
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects3d\/$/,
    handler: () => mockServices.projects3d.createProject3D(),
  },
  {
    method: 'GET',
    pattern: /^\/api\/projects3d\/$/,
    handler: () => mockServices.projects3d.listProjects3D(),
  },
  {
    method: 'GET',
    pattern: /^\/api\/projects3d\/(?<id>[^/]+)\/$/,
    handler: (p) => mockServices.projects3d.getProject3D(p.id),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/projects3d\/(?<id>[^/]+)\/$/,
    handler: (p) => mockServices.projects3d.deleteProject3D(p.id),
    noContent: true,
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects3d\/(?<projectId>[^/]+)\/versions\/$/,
    handler: (p, body) =>
      mockServices.projects3d.saveSceneVersion3D(
        p.projectId,
        (body as { scene_json: never }).scene_json,
      ),
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects\/(?<projectId>[^/]+)\/ai\/create-scene\/$/,
    handler: (p, body) => {
      const b = body as { prompt: string; model?: string };
      return mockServices.ai.createAIScene(p.projectId, b.prompt, undefined, b.model);
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects\/(?<projectId>[^/]+)\/ai\/edit-scene\/$/,
    handler: (p, body) => {
      const b = body as {
        prompt: string;
        current_scene: never;
        base_version_id: number | null;
        model?: string;
      };
      return mockServices.ai.editAIScene(
        p.projectId,
        b.prompt,
        b.current_scene,
        b.base_version_id,
        undefined,
        b.model,
      );
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects\/(?<projectId>[^/]+)\/ai\/accept-proposal\/$/,
    handler: (p, body) => mockServices.ai.acceptAIProposal(p.projectId, body as never),
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects3d\/(?<projectId>[^/]+)\/ai\/create-scene\/$/,
    handler: (p, body) => {
      const b = body as { prompt: string; model?: string };
      return mockServices.ai3d.createAIScene3D(p.projectId, b.prompt, undefined, b.model);
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects3d\/(?<projectId>[^/]+)\/ai\/edit-scene\/$/,
    handler: (p, body) => {
      const b = body as {
        prompt: string;
        current_scene: never;
        base_version_id: number | null;
        model?: string;
      };
      return mockServices.ai3d.editAIScene3D(
        p.projectId,
        b.prompt,
        b.current_scene,
        b.base_version_id,
        undefined,
        b.model,
      );
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects3d\/(?<projectId>[^/]+)\/ai\/accept-proposal\/$/,
    handler: (p, body) => mockServices.ai3d.acceptAIProposal3D(p.projectId, body as never),
  },
];

// `/api/projects3d/` is both a GET (list) and POST (create) route sharing
// one pattern -- matched above via distinct `method` entries in `routes`,
// resolved in declaration order by `findRoute`.
function findRoute(
  method: string,
  pathname: string,
): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(pathname);
    if (match) {
      return { route, params: { ...(match.groups ?? {}) } };
    }
  }
  return null;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
}

async function requestBody(init?: RequestInit): Promise<unknown> {
  if (!init?.body) return undefined;
  if (typeof init.body !== 'string') return undefined;
  try {
    return JSON.parse(init.body);
  } catch {
    return init.body;
  }
}

let installed = false;

/** Installs the mock-fetch shim on `window.fetch`/`globalThis.fetch`. Safe
 * to call more than once (a second call is a no-op) -- called exactly once,
 * from `../main.tsx`, when `VITE_USE_MOCK_BACKEND=true`. */
export function installMockFetch(): void {
  if (installed) return;
  installed = true;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = requestUrl(input);
    const method = requestMethod(input, init);
    let pathname: string;
    let search: URLSearchParams;
    try {
      const parsed = new URL(url, 'http://mock-backend.local');
      pathname = parsed.pathname;
      search = parsed.searchParams;
    } catch {
      return originalFetch(input, init);
    }

    if (!pathname.startsWith('/api/') && !pathname.startsWith('/accounts/')) {
      return originalFetch(input, init);
    }

    const matched = findRoute(method, pathname);
    if (!matched) {
      // Unknown /api or /accounts path under mock mode -- surface as a 404
      // ApiError-shaped response rather than silently hitting a real
      // network, so a gap in this route table fails loudly instead of
      // quietly leaking a real request.
      return new Response(JSON.stringify({ detail: 'Not found (unhandled mock route).' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { route, params } = matched;
    const body = await requestBody(init);

    try {
      const result = await route.handler(params, body, search);
      if (route.noContent || result === undefined) {
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        return new Response(JSON.stringify(err.body), {
          status: err.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw err;
    }
  };
}
