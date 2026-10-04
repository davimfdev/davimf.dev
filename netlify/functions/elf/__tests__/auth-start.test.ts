import { describe, it, expect, vi, afterEach } from 'vitest';
import { readOAuthState } from '../lib/oauth-state';
import { handleAuthStart } from '../auth-start';

const start = (r: Request, enforceRateLimit = vi.fn(async () => {})) =>
  handleAuthStart(r, { enforceRateLimit });

afterEach(() => vi.unstubAllEnvs());

const req = (url = 'https://elf.davimf.dev/api/elf/auth/start') => new Request(url);

async function locationOf(res: Response): Promise<URL> {
  const location = res.headers.get('Location');
  if (!location) throw new Error('resposta sem Location');
  return new URL(location);
}

describe('handleAuthStart', () => {
  it('redireciona para o Discord', async () => {
    const res = await start(req());
    expect(res.status).toBe(302);
    expect((await locationOf(res)).origin + (await locationOf(res)).pathname).toBe(
      'https://discord.com/api/oauth2/authorize',
    );
  });

  it('pede apenas o escopo identify', async () => {
    const location = await locationOf(await start(req()));
    expect(location.searchParams.get('scope')).toBe('identify');
  });

  it('usa a redirect URI do $elfControl, não a do site', async () => {
    const location = await locationOf(await start(req()));
    expect(location.searchParams.get('redirect_uri')).toBe(process.env.ELF_DISCORD_REDIRECT_URI);
  });

  it('seta o cookie de state com HttpOnly e Secure', async () => {
    const setCookie = (await start(req())).headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('elf_oauth_state=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
  });

  it('guarda o returnTo relativo dentro do state', async () => {
    const location = await locationOf(
      await start(req('https://elf.davimf.dev/api/elf/auth/start?returnTo=/contas')),
    );
    const state = location.searchParams.get('state');
    expect(readOAuthState(state, state)).toEqual({ returnTo: '/contas' });
  });

  it('troca returnTo externo pela raiz', async () => {
    const location = await locationOf(
      await start(req('https://elf.davimf.dev/api/elf/auth/start?returnTo=https://evil.example')),
    );
    const state = location.searchParams.get('state');
    expect(readOAuthState(state, state)).toEqual({ returnTo: '/' });
  });

  it('limita por IP do cliente', async () => {
    const enforceRateLimit = vi.fn(async () => {});
    await start(
      new Request('https://elf.davimf.dev/api/elf/auth/start', { headers: { 'x-real-ip': '177.1.2.3' } }),
      enforceRateLimit,
    );
    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'auth_start', identifier: '177.1.2.3', limit: 20 }),
    );
  });

  it('falha limpo sem configuração de OAuth', async () => {
    vi.stubEnv('DISCORD_CLIENT_ID', '');
    const res = await start(req());
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('OAUTH_NOT_CONFIGURED');
  });
});
