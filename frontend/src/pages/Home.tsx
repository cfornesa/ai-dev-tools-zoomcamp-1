import { useAuth } from '../auth/useAuth';
import Gallery from './Gallery';

function Home() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading…
      </p>
    );
  }

  if (auth.status === 'signed-out') {
    return (
      <div className="content-panel home-panel">
        <div className="centered-state">
          <p>Sign in to see your projects.</p>
          <a className="shell-action" href="/accounts/login/">
            Sign in with Google
          </a>
        </div>
      </div>
    );
  }

  return <Gallery />;
}

export default Home;
