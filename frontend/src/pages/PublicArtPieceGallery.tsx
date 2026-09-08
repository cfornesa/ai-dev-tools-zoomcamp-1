import { Navigate } from 'react-router-dom';

/**
 * Issue #491: `/art-pieces/gallery` is preserved as a backward-compatible
 * route. It redirects to the unified public gallery with the type filter
 * pre-set to Generated, rather than maintaining a separate listing surface.
 * The route itself stays alive and never 404s.
 */
function PublicArtPieceGallery() {
  return <Navigate to="/gallery?type=generated" replace />;
}

export default PublicArtPieceGallery;
