import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="content-panel">
      <section className="centered-state" aria-labelledby="not-found-heading">
        <h2 id="not-found-heading">Page not found</h2>
        <p>That address does not exist or is unavailable.</p>
        <nav aria-label="Recovery navigation">
          <Link className="shell-action" to="/">
            Home
          </Link>
          <Link className="shell-action" to="/gallery">
            Public gallery
          </Link>
        </nav>
      </section>
    </div>
  );
}

export default NotFound;
