const productionBackendTarget = 'http://127.0.0.1:8000';

/**
 * The deployment entry point sets FRONTEND_SERVE_MODE=preview. Keep the
 * browser-QA override available to development runs, but never let it replace
 * the local HTTP backend used by the published preview server.
 */
export function resolveBackendProxyTarget(
  frontendServeMode: string | undefined,
  browserQaBackendUrl: string | undefined,
): string {
  if (frontendServeMode === 'preview') return productionBackendTarget;
  return browserQaBackendUrl ?? productionBackendTarget;
}
