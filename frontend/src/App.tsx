import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import Layout from './components/Layout';
import EditorWorkspace from './pages/EditorWorkspace';
import Home from './pages/Home';
import PublicGallery from './pages/PublicGallery';
import PublicProjectViewer from './pages/PublicProjectViewer';
import Templates from './pages/Templates';
import AccountSettings from './pages/AccountSettings';

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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
