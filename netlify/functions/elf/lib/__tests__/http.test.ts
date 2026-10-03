import { describe, it, expect } from 'vitest';
import {
  ApiError,
  errorResponse,
  isAllowedOrigin,
  jsonResponse,
  requireAllowedOrigin,
  shouldUseSecureCookies,
  withElf,
} from '../http';

const req = (init: RequestInit & { url?: string } = {}) =>
  new Request(init.url ?? 'https://elf.davimf.dev/api/elf/health', init);

describe('isAllowedOrigin', () => {
  it('aceita origem da allowlist', () => {
    expect(isAllowedOrigin('https://elf.davimf.dev')).toBe(true);
  });
  it('recusa origem fora da allowlist', () => {
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
  });
  it('recusa origem que apenas começa igual', () => {
    expect(isAllowedOrigin('https://elf.davimf.dev.evil.example')).toBe(false);
  });
  it('recusa null', () => {
    expect(isAllowedOrigin(null)).toBe(false);
  });
});

describe('jsonResponse', () => {
  it('devolve o corpo e o status', async () => {
    const res = jsonResponse({ ok: true }, 200, req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
  it('inclui X-Request-Id', () => {
    const res = jsonResponse({ ok: true }, 200, req());
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
  });
  it('ecoa origem permitida', () => {
    const res = jsonResponse({ ok: true }, 200, req({ headers: { origin: 'https://elf.davimf.dev' } }));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://elf.davimf.dev');
  });
  it('omite o header para origem não permitida', () => {
    const res = jsonResponse({ ok: true }, 200, req({ headers: { origin: 'https://evil.example' } }));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('errorResponse', () => {
  it('usa o envelope padrão', async () => {
    const res = errorResponse(new ApiError('ACCOUNT_NOT_FOUND', 'Conta não encontrada.', 404), req());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'ACCOUNT_NOT_FOUND', message: 'Conta não encontrada.' },
    });
  });
  it('inclui campos extras quando houver', async () => {
    const res = errorResponse(
      new ApiError('VERSION_CONFLICT', 'Alterado em outro dispositivo.', 409, { current: { id: 'x' } }),
      req(),
    );
    const body = (await res.json()) as { error: Record<string, unknown> };
    expect(body.error.current).toEqual({ id: 'x' });
  });
});

describe('requireAllowedOrigin', () => {
  it('recusa POST por cookie vindo de origem desconhecida', () => {
    const post = req({ method: 'POST', headers: { origin: 'https://evil.example' } });
    expect(() => requireAllowedOrigin(post, true)).toThrow(ApiError);
  });
  it('aceita POST por Bearer de qualquer origem', () => {
    const post = req({ method: 'POST', headers: { origin: 'https://evil.example' } });
    expect(() => requireAllowedOrigin(post, false)).not.toThrow();
  });
  it('não exige origem em GET', () => {
    expect(() => requireAllowedOrigin(req(), true)).not.toThrow();
  });
});

describe('shouldUseSecureCookies', () => {
  it('liga Secure em produção', () => {
    expect(shouldUseSecureCookies(req())).toBe(true);
  });
  it('desliga Secure em localhost', () => {
    expect(shouldUseSecureCookies(req({ url: 'http://localhost:5173/api/elf/health' }))).toBe(false);
  });
});

describe('withElf', () => {
  it('responde 204 no preflight sem chamar o handler', async () => {
    let called = false;
    const res = await withElf(async () => {
      called = true;
      return jsonResponse({}, 200, req());
    })(req({ method: 'OPTIONS', headers: { origin: 'https://elf.davimf.dev' } }));
    expect(res.status).toBe(204);
    expect(called).toBe(false);
  });
  it('entrega ao handler o mesmo request id do header da resposta', async () => {
    const res = await withElf(async (request, ctx) =>
      jsonResponse({ requestId: ctx.requestId }, 200, request),
    )(req());
    const body = (await res.json()) as { requestId: string };
    expect(body.requestId).toBe(res.headers.get('X-Request-Id'));
  });
  it('converte ApiError em resposta com o código', async () => {
    const res = await withElf(async () => {
      throw new ApiError('VALIDATION_FAILED', 'Dados inválidos.', 400);
    })(req());
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');
  });
  it('converte erro inesperado em 500 genérico sem vazar nome de tabela nem SQL', async () => {
    const res = await withElf(async () => {
      throw new Error('relation "elf_sessions" does not exist at INSERT INTO users');
    })(req());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('elf_sessions');
    expect(body.error.message).not.toContain('INSERT');
  });
});
