import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchConnectedMcpApps, revokeConnectedMcpApp } from './connectedMcpApps';

describe('connected MCP app API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads the signed-in account application list', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 8,
            name: 'Client',
            scopes: ['gallery:read'],
            last_authorized: '2026-10-04T12:00:00Z',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    await expect(fetchConnectedMcpApps()).resolves.toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/account/connected-apps/',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends a CSRF-protected delete for a single application', async () => {
    document.cookie = 'csrftoken=test-csrf';
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ revoked: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(revokeConnectedMcpApp(8)).resolves.toEqual({ revoked: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/account/connected-apps/8/',
      expect.objectContaining({ method: 'DELETE', headers: expect.any(Headers) }),
    );
    const headers = fetch.mock.calls[0][1]?.headers;
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get('X-CSRFToken')).toBe('test-csrf');
  });
});
