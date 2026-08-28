import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';

/** Task 130 (issue #162): these routes pull in the app's heaviest
 * dependencies (p5.js, React Flow, JSZip/export, the AI proposal stack) --
 * lazy-loading them keeps that weight out of the initial bundle so a
 * first-time visitor to `/` only pays for `Home` + routing. `Home` stays a
 * static import since it's the landing page most visits hit first. */
const ArtPieceStudio = lazy(() => import('./pages/ArtPieceStudio'));
const EditorWorkspace = lazy(() => import('./pages/EditorWorkspace'));
const PublicGallery = lazy(() => import('./pages/PublicGallery'));
const PublicProjectViewer = lazy(() => import('./pages/PublicProjectViewer'));
const Templates = lazy(() => import('./pages/Templates'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));

/** Task 94 (issue #94): `/projects/:id/settings` no longer exists as a
 * standalone page (project-metadata editing is now the editor's own
 * "Details" panel) — this redirects any existing bookmark/link straight to
 * that project's unified editor instead of leaving the old URL dead. */
function ProjectSettingsRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/projects/${id}`} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              {/* Task 50: reachable without authentication -- this route
                  never checks `useAuth()`'s status, unlike the index route's
                  Home/Gallery split. */}
              <Route path="gallery" element={<PublicGallery />} />
              {/* Task 51 (issue #53): the public project viewer -- also
                  reachable without authentication, and identical for
                  anonymous and signed-in visitors (see PublicProjectViewer.tsx
                  for why). `/p/<public_id>` matches the `public_id`-keyed
                  URL scheme Task 49's API already uses
                  (`/api/public/projects/<public_id>/`). */}
              <Route path="p/:id" element={<PublicProjectViewer />} />
              <Route path="templates" element={<Templates />} />
              {/* Issue #199 (epic #196): the first-slice multi-library AI
                  art generation flow (Canvas2D only). Deliberately not
                  yet linked from the header/gallery nav -- see this
                  issue's grooming for why the direct route is enough for
                  this slice. */}
              <Route path="art-pieces" element={<ArtPieceStudio />} />
              <Route path="account/settings" element={<AccountSettings />} />
              <Route path="projects/:id" element={<EditorWorkspace />} />
              {/* Task 94 (issue #94): project-metadata editing folded into
                  the editor itself as a "Details" panel (EditorWorkspace.tsx)
                  — the old standalone `ProjectMetadataForm.tsx` page is
                  deleted. A redirect (rather than removing the route
                  outright) keeps any existing bookmark/link to
                  `/projects/:id/settings` working, landing on the same
                  project's unified editor instead of a dead route. */}
              <Route path="projects/:id/settings" element={<ProjectSettingsRedirect />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
