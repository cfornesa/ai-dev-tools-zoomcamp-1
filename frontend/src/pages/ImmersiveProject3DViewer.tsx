import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getPublicProject3D, type PublicProject3D } from '../api/projects3d';
import Scene3DPreview from './Scene3DPreview';
import type { Scene3DDocument } from './scene3dTypes';

type LoadState = 'loading' | 'ready' | 'unavailable' | 'error';

/**
 * Issue #311: the immersive first-person free-fly view -- the epic
 * 237/#274's last remaining scope item, grounded in a direct investigation
 * of the reference implementation's own `/immersive/pieces/{id}` route
 * (`augment-humankind`'s `immersive-gallery.js`, a sibling repo, not
 * guessed): a full separate page (not an in-page modal/overlay), reusing
 * the exact same piece content as the normal public viewer, just wrapped
 * in a camera rig that adds arrow-key "fly" translation
 * (`Scene3DPreview.tsx`'s new `flyControls` prop) on top of the existing
 * mouse-drag orbit/wheel-zoom. Confirmed no WebXR/Pointer-Lock API is
 * involved in the reference either (`vr-mode-ui: enabled: false`, no
 * `requestPointerLock` call anywhere in its source) -- this is a
 * first-person *camera style*, not a VR-headset feature.
 *
 * ## Scoped down from the reference on purpose
 *
 * The reference's immersive route also lets the same webcam hand-tracking
 * pipeline that drives "steer the piece"/the camera theremin (#294/#309)
 * steer this free-fly camera too. The reference's own newer TypeScript
 * port (a sibling repo the same investigation found) already dropped that
 * tie-in when porting off the original PHP/A-Frame stack -- kept here as
 * the same deliberate v1 scope boundary: mouse + arrow-key fly only, no
 * hand-tracking integration. A-Frame itself is irrelevant to this port --
 * this app's 3D document family only ever renders through Three.js.
 *
 * ## A real separate page, opened in a new tab
 *
 * Mirrors the reference's own entry point (a plain link with
 * `target="_blank"`, not a same-tab navigation or in-page overlay) --
 * `PublicProject3DViewer.tsx`'s "View in immersive mode" link does the
 * same. Exiting is just closing the tab or navigating back, matching the
 * reference exactly (it has no dedicated in-page exit affordance beyond
 * that, only an unrelated "reset view" convenience).
 */
function ImmersiveProject3DViewer() {
  const { id } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<PublicProject3D | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadState('loading');
    setProject(null);

    getPublicProject3D(id)
      .then((fetched) => {
        if (cancelled) return;
        setProject(fetched);
        setLoadState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          setLoadState('unavailable');
        } else {
          setLoadState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading project…
      </p>
    );
  }

  if (loadState === 'unavailable') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          This project isn't available. It may have been unpublished, deleted, or never existed.
        </p>
        <p>
          <Link to="/gallery">Back to the public gallery</Link>
        </p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          Something went wrong loading this project. Please try again.
        </p>
        <p>
          <Link to="/gallery">Back to the public gallery</Link>
        </p>
      </div>
    );
  }

  if (!project) return null; // unreachable once loadState === 'ready'

  return (
    <div className="immersive-project3d-viewer">
      <header>
        <h2>{project.title}</h2>
        <p className="public-project-attribution">By {project.owner}</p>
        <p role="note">
          Drag to look around, scroll/pinch to zoom, and use the arrow keys to fly through the
          piece.
        </p>
      </header>
      <section role="region" aria-label="Preview" data-panel="preview">
        {project.current_version && (
          <Scene3DPreview
            scene={project.current_version.scene_json as unknown as Scene3DDocument}
            screenshotBaseName={project.title}
            showGestureControl={false}
            flyControls
          />
        )}
      </section>
    </div>
  );
}

export default ImmersiveProject3DViewer;
