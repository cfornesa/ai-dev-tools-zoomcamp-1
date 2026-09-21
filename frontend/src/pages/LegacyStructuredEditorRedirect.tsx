import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { getProject } from '../api/projects';
import { getProject3D } from '../api/projects3d';

type LegacyStructuredEditorRedirectProps = { kind: '2d' | '3d' };

/**
 * Compatibility shim for the pre-profile editor URLs. The resource API owns
 * the canonical owner handle/slug, so old bookmarks never reconstruct a URL
 * from a display title or expose a second editor route.
 */
export default function LegacyStructuredEditorRedirect({
  kind,
}: LegacyStructuredEditorRedirectProps) {
  const { id = '' } = useParams<{ id: string }>();
  const [destination, setDestination] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = kind === '2d' ? getProject(id) : getProject3D(id);
    load
      .then((resource) => {
        if (cancelled) return;
        if (resource.editor_url) setDestination(resource.editor_url);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, kind]);

  if (destination) return <Navigate to={destination} replace />;
  if (failed) {
    return (
      <section role="alert">
        <h2>Editor unavailable</h2>
        <p>
          This editor link is no longer available. Return to the gallery and choose the piece again.
        </p>
        <a href="/gallery">Back to gallery</a>
      </section>
    );
  }
  return <p role="status">Opening the canonical editor…</p>;
}
