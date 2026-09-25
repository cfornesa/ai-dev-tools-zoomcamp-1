function productionBackendTarget(): string {
  return process.env.BACKEND_PROXY_TARGET ?? 'http://127.0.0.1:8000';
}

/**
 * The deployment entry point sets FRONTEND_SERVE_MODE=preview. Keep the
 * browser-QA override available to development runs. The deployment launcher
 * supplies BACKEND_PROXY_TARGET when Replit's external PORT would otherwise
 * collide with Django's local listener.
 */
export function resolveBackendProxyTarget(
  frontendServeMode: string | undefined,
  browserQaBackendUrl: string | undefined,
): string {
  if (frontendServeMode === 'preview') return productionBackendTarget();
  return browserQaBackendUrl ?? productionBackendTarget();
}
