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
const AiEditorWorkspace = lazy(() => import('./pages/AiEditorWorkspace'));
const AiProject3DWorkspace = lazy(() => import('./pages/AiProject3DWorkspace'));
const ArtPieceStudio = lazy(() => import('./pages/ArtPieceStudio'));
const ArtPieceEditor = lazy(() => import('./pages/ArtPieceEditor'));
const PublicArtPieceGallery = lazy(() => import('./pages/PublicArtPieceGallery'));
const PublicArtPieceViewer = lazy(() => import('./pages/PublicArtPieceViewer'));
const ArtPieceManagement = lazy(() => import('./pages/ArtPieceManagement'));
const EditorWorkspace = lazy(() => import('./pages/EditorWorkspace'));
const Project3DWorkspace = lazy(() => import('./pages/Project3DWorkspace'));
const PublicGallery = lazy(() => import('./pages/PublicGallery'));
const PublicProjectViewer = lazy(() => import('./pages/PublicProjectViewer'));
const PublicProject3DViewer = lazy(() => import('./pages/PublicProject3DViewer'));
const ImmersiveProject3DViewer = lazy(() => import('./pages/ImmersiveProject3DViewer'));
const ImmersiveArtPieceViewer = lazy(() => import('./pages/ImmersiveArtPieceViewer'));
const Templates = lazy(() => import('./pages/Templates'));
const CreateChooser = lazy(() => import('./pages/CreateChooser'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));

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
              {/* Issue #296: the 3D counterpart of `p/:id` above --
                  `/p3d/<public_id>` matches the `public_id`-keyed
                  `/api/public/projects3d/<public_id>/` route. */}
              <Route path="p3d/:id" element={<PublicProject3DViewer />} />
              <Route path="templates" element={<Templates />} />
              {/* Issue #268: the gallery header's "+" icon navigates here --
                  a card-grid chooser for all 5 creation actions, styled
                  like the templates route above. */}
              <Route path="create" element={<CreateChooser />} />
              {/* Issue #199 (epic #196): the first-slice multi-library AI
                  art generation flow (Canvas2D only). Deliberately not
                  yet linked from the header/gallery nav -- see this
                  issue's grooming for why the direct route is enough for
                  this slice. */}
              <Route path="art-pieces" element={<ArtPieceStudio />} />
              <Route path="art-pieces/manage" element={<ArtPieceManagement />} />
              <Route path="art-pieces/:id/edit" element={<ArtPieceEditor />} />
              <Route path="art-pieces/gallery" element={<PublicArtPieceGallery />} />
              <Route path="art-pieces/p/:id" element={<PublicArtPieceViewer />} />
              <Route path="art-pieces/immersive/:id" element={<ImmersiveArtPieceViewer />} />
              <Route path="account/settings" element={<AccountSettings />} />
              <Route path="admin/settings" element={<AdminSettings />} />
              <Route path="projects/:id" element={<EditorWorkspace />} />
              {/* Issue #223: the 2D AI-assisted editor -- a distinct route
                  over the same Project/SceneVersion document family as
                  the manual editor above, not a separate document family
                  (contrast with the genuinely separate 3D document
                  family). No layers/manual-editing UI; that's the manual
                  editor's concept. */}
              <Route path="ai-projects/:id" element={<AiEditorWorkspace />} />
              {/* Issue #226: the 3D manual editor -- a genuinely separate
                  document family (Project3D/SceneVersion3D, #208's
                  decision), not a variant of the 2D routes above. */}
              <Route path="projects3d/:id" element={<Project3DWorkspace />} />
              {/* Issue #231: the 3D AI-assisted editor -- sibling route to
                  the 3D manual editor above, reusing the same Project3D/
                  SceneVersion3D document family. */}
              <Route path="ai-projects3d/:id" element={<AiProject3DWorkspace />} />
              {/* Task 94 (issue #94): project-metadata editing folded into
                  the editor itself as a "Details" panel (EditorWorkspace.tsx)
                  — the old standalone `ProjectMetadataForm.tsx` page is
                  deleted. A redirect (rather than removing the route
                  outright) keeps any existing bookmark/link to
                  `/projects/:id/settings` working, landing on the same
                  project's unified editor instead of a dead route. */}
              <Route path="projects/:id/settings" element={<ProjectSettingsRedirect />} />
            </Route>
            {/* Issue #292: a chrome-less counterpart of `p/:id` above, for
                embedding a published project's public view in an
                `<iframe>` from another origin -- deliberately a *sibling*
                route to the `Layout`-wrapped one, not nested inside it, so
                none of `Layout.tsx`'s app-shell chrome (nav header,
                account links, mobile menu) ever renders here. Reuses
                `PublicProjectViewer.tsx` unchanged (it reads no
                Layout-provided context -- see that component's own doc
                comment on how it reads reduced-motion/camera-overlay
                state independently via localStorage) rather than a
                duplicate component, since the only actual difference is
                which chrome wraps it. */}
            <Route path="embed/p/:id" element={<PublicProjectViewer />} />
            {/* Issue #296: the 3D counterpart of `embed/p/:id` above --
                chrome-less, sibling to the Layout-wrapped `p3d/:id` route,
                for embedding a published 3D piece in an `<iframe>`. */}
            <Route path="embed/p3d/:id" element={<PublicProject3DViewer />} />
            {/* Issue #435: the art-pieces counterpart of `embed/p/:id`
                above -- chrome-less, sibling to the Layout-wrapped
                `art-pieces/p/:id` route. Reuses `PublicArtPieceViewer.tsx`
                unchanged in topology (it reads no Layout context); the
                component's own `isEmbedRoute` check hides its page-level
                title/description/embed-button/back-link on this route
                while keeping the piece's own stage toolbar (Screenshot,
                Download, Sound, Piece controls, Steer, Guide, Fullscreen)
                fully functional, since that belongs to the embed too. */}
            <Route path="embed/art-pieces/:id" element={<PublicArtPieceViewer />} />
            {/* Issue #446: the immersive counterpart of `embed/art-pieces/:id`
                above -- chrome-less, sibling to the Layout-wrapped
                `art-pieces/immersive/:id` route. Reuses
                `ImmersiveArtPieceViewer.tsx` unchanged in topology (it
                reads no Layout context); the component's own
                `isEmbedRoute` check hides its page-level title/
                instructions/embed-button/back-link on this route while
                keeping the piece's own stage and shared `PieceStageControls`
                toolbar fully functional, since that belongs to the embed
                too. */}
            <Route path="embed/art-pieces/immersive/:id" element={<ImmersiveArtPieceViewer />} />
            {/* Issue #311: the immersive first-person free-fly view --
                chrome-less like the embed routes above (this is a focused,
                full-page viewing experience, opened in a new tab from
                PublicProject3DViewer.tsx's own entry link, not something
                that needs the app-shell nav around it). A distinct page
                from `embed/p3d/:id`: same underlying scene content, but
                rendered with Scene3DPreview.tsx's flyControls enabled
                instead of iframe-embedding chrome. */}
            <Route path="immersive/p3d/:id" element={<ImmersiveProject3DViewer />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
