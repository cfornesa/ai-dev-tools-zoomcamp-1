import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { isMockBackendEnabled } from './services';
import { installMockFetch } from './mocks/installMockFetch';

// Task 214 (issue #246): the single composition-root check for
// VITE_USE_MOCK_BACKEND -- see src/services/index.ts's doc comment for why
// this is a global fetch shim rather than rewiring pages to import
// src/services directly.
if (isMockBackendEnabled) {
  installMockFetch();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
