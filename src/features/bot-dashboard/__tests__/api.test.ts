import { afterEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi } from '../api';

afterEach(() => vi.unstubAllGlobals());

describe('dashboardApi', () => {
  it('always uses the opaque cookie session and the public /api routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);
    await dashboardApi.guilds();
    expect(fetchMock).toHaveBeenCalledWith('/api/bot-guilds', expect.objectContaining({ credentials: 'include' }));
  });

  it('surfaces stable backend error codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 409, json: async () => ({ error: { code: 'SNAPSHOT_STALE', message: 'stale' } }),
    }));
    await expect(dashboardApi.config('123')).rejects.toMatchObject({ code: 'SNAPSHOT_STALE', status: 409 });
  });
});
