/**
 * Task 214 (issue #246): the single composition point that picks the
 * active `BackendServices` implementation. Every consumer imports
 * `services` from here rather than choosing between `./real` and
 * `./mock` itself — see AGENTS.md's "one env-driven switch ... selected
 * once at a natural composition point (e.g. a single module that exports
 * the active services object, not scattered `if` checks through page
 * components)".
 *
 * `VITE_USE_MOCK_BACKEND=true` (see `frontend/.env.example`) switches this
 * to the in-memory mock (`./mock`), letting the app run and be developed/
 * demoed with zero real backend running. `../../src/main.tsx` installs a
 * matching global-`fetch` shim (`../mocks/installMockFetch.ts`) when the
 * same flag is set, so existing pages -- which still import `../api/*.ts`
 * functions directly, unchanged -- transparently hit the mock instead of a
 * real network request without themselves needing to know about this
 * module. Code that wants the typed services object directly (e.g. new
 * code written against this layer, or tests) can still import `services`
 * from here.
 */
import { realServices } from './real';
import { mockServices } from './mock';
import type { BackendServices } from './types';

export const isMockBackendEnabled = import.meta.env.VITE_USE_MOCK_BACKEND === 'true';

export const services: BackendServices = isMockBackendEnabled ? mockServices : realServices;

export type { BackendServices } from './types';
