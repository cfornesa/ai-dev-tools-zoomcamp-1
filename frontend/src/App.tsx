import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import Layout from './components/Layout';
import EditorPlaceholder from './pages/EditorPlaceholder';
import Home from './pages/Home';
import ProjectMetadataForm from './pages/ProjectMetadataForm';
import Templates from './pages/Templates';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="templates" element={<Templates />} />
            <Route path="projects/:id" element={<EditorPlaceholder />} />
            <Route path="projects/:id/settings" element={<ProjectMetadataForm />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
