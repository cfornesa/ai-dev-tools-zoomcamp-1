import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="content-panel">
      <section className="centered-state" aria-labelledby="not-found-heading">
        <h2 id="not-found-heading">Page not found</h2>
        <p>That address does not exist or is unavailable.</p>
        {/* Issue #485 QA: these links carry distinct accessible names --
            bare "Home"/"Public gallery" would duplicate the shell nav's
            identically-named links and leave assistive-tech users (and
            Playwright's strict mode) two ambiguous targets. */}
        <nav aria-label="Recovery navigation">
          <Link className="shell-action" to="/">
            Return to the home page
          </Link>
          <Link className="shell-action" to="/gallery">
            Browse the public gallery
          </Link>
        </nav>
      </section>
    </div>
  );
}

export default NotFound;
