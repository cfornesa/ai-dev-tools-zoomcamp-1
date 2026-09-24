/**
 * Issue #791: `App.tsx` lazy-loads its route modules, so the first test to render a route pays that chunk's
 * import inside the test's own 1s `findBy*` window. Under a parallel full-suite run (CPU contention) that
 * import can take longer than the window, which produced order/load-dependent timing failures. Importing the
 * modules up front moves the cost into a `beforeAll` (with its own generous hook timeout) so the assertions
 * measure rendering, not module loading -- without lengthening any assertion timeout.
 */
export const PRELOAD_TIMEOUT_MS = 60_000;

export async function preloadAppRoutes(): Promise<void> {
  await Promise.all([
    import('../pages/PublicGallery'),
    import('../pages/PublicProjectViewer'),
    import('../pages/PublicProject3DViewer'),
    import('../pages/ImmersiveProject3DViewer'),
    import('../pages/PublicArtPieceViewer'),
    import('../pages/PublicArtPieceGallery'),
    import('../pages/ImmersiveArtPieceViewer'),
    import('../pages/CanonicalImmersiveStructuredPiece'),
    import('../pages/Templates'),
    import('../pages/CreateChooser'),
  ]);
}
