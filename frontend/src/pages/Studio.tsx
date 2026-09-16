import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import Gallery from './Gallery';

/** The authenticated workspace. Anonymous visitors belong on the public gallery. */
function Studio() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading…
      </p>
    );
  }

  if (auth.status === 'signed-out') {
    return <Navigate to="/gallery" replace />;
  }

  return <Gallery />;
}

export default Studio;
