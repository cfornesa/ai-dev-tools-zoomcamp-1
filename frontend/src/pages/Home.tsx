import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

function Home() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading…
      </p>
    );
  }

  return <Navigate to={auth.status === 'signed-in' ? '/studio' : '/gallery'} replace />;
}

export default Home;
