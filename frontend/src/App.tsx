import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import Layout from './components/Layout';
import EditorWorkspace from './pages/EditorWorkspace';
import Home from './pages/Home';
import ProjectMetadataForm from './pages/ProjectMetadataForm';
import PublicGallery from './pages/PublicGallery';
import Templates from './pages/Templates';

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
            <Route path="templates" element={<Templates />} />
            <Route path="projects/:id" element={<EditorWorkspace />} />
            <Route path="projects/:id/settings" element={<ProjectMetadataForm />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
