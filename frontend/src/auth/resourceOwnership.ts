import type { AuthState } from './context';

/**
 * Issue #458: `PROJECT_READ`/`PROJECT3D_READ` deliberately let any
 * visitor -- including anonymous ones -- fetch a *published* project's
 * detail response (`scenes/permissions.py`), so the authoring workspaces
 * (`EditorWorkspace.tsx`, `Project3DWorkspace.tsx`,
 * `AiEditorWorkspace.tsx`, `AiProject3DWorkspace.tsx`) can't tell "the
 * fetch succeeded" apart from "the viewer actually owns this" the way a
 * private project's 403/404 already does for them. Each of those must
 * redirect a non-owner to the read-only public viewer instead of
 * rendering Edit/Publish/Save controls -- this is the shared "is it
 * safe to render owner UI yet" check they run right after loading the
 * project, comparing the detail response's `owner` username against the
 * signed-in user's own. Not itself a hook (calls none) -- callers pass
 * in their own already-obtained `useAuth()` result.
 *
 * Returns `'pending'` while auth is still resolving (never render an
 * owner/non-owner decision off a stale or default auth state), `true`/
 * `false` once resolved. A project with no `owner` field can't be
 * compared and is treated as `false` (never render owner UI for it).
 */
export function resourceOwnershipStatus(
  auth: AuthState,
  ownerUsername: string | null | undefined,
): 'pending' | boolean {
  if (auth.status === 'loading') return 'pending';
  if (auth.status !== 'signed-in') return false;
  if (!ownerUsername) return false;
  return auth.user.username === ownerUsername;
}
