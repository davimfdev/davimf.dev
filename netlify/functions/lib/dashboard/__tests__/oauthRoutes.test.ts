import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler as startLogin } from '../../../dashboard-login';
import { handleCallback } from '../../../callback';

describe('dashboard Discord OAuth routes', () => {
  beforeEach(() => {
    process.env.DASHBOARD_SESSION_SECRET = '0123456789abcdef0123456789abcdef';
    process.env.DISCORD_CLIENT_ID = 'client-id';
    process.env.DISCORD_CLIENT_SECRET = 'client-secret';
    process.env.DISCORD_REDIRECT_URI = 'https://davimf.dev/api/callback';
  });

  it('starts OAuth with state cookie and required scopes', async () => {
    const response = await startLogin({
      httpMethod: 'GET',
      queryStringParameters: { returnTo: '/dashboard/g1' },
      headers: {},
    } as never, {} as never);
    if (!response) throw new Error('Expected a handler response');
    expect(response.statusCode).toBe(302);
    expect(response.headers?.['Set-Cookie']).toContain('bot_dashboard_oauth_state=');
    const location = new URL(String(response.headers?.Location));
    expect(location.searchParams.get('state')).toBeTruthy();
    expect(location.searchParams.get('scope')).toBe('identify guilds guilds.members.read');
  });

  it('rejects callback without matching state before token exchange', async () => {
    const fetchImpl = vi.fn();
    const response = await handleCallback(new Request('https://davimf.dev/api/callback?code=x&state=bad'), {
      fetchImpl: fetchImpl as never,
      createSession: vi.fn() as never,
    });
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('stores tokens server-side and redirects without leaking them', async () => {
    process.env.DISCORD_REDIRECT_URI = 'http://localhost:8888/api/callback';
    const started = await startLogin({ httpMethod: 'GET', queryStringParameters: null, headers: {} } as never, {} as never);
    if (!started) throw new Error('Expected a handler response');
    const cookieHeader = String(started.headers?.['Set-Cookie']);
    const state = new URL(String(started.headers?.Location)).searchParams.get('state')!;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-secret', refresh_token: 'refresh-secret', expires_in: 3600,
        scope: 'identify guilds guilds.members.read',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1' }), { status: 200 }));
    const createSession = vi.fn().mockResolvedValue('signed-session');
    const response = await handleCallback(new Request(`https://davimf.dev/api/callback?code=x&state=${encodeURIComponent(state)}`, {
      headers: { cookie: cookieHeader.split(';')[0] },
    }), { fetchImpl: fetchImpl as never, createSession });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', accessToken: 'access-secret' }));
    expect(response.headers.get('location')).toBe('/dashboard');
    expect(response.headers.get('location')).not.toContain('access-secret');
    expect(response.headers.get('set-cookie')).toContain('bot_dashboard_session=signed-session');
    expect(response.headers.get('set-cookie')).not.toContain('Secure');
  });
});
