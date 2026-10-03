import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { securityHeadersMiddleware } from '../securityHeaders';

/** `res` mínimo: só o setHeader, que é a única coisa que o middleware usa. */
function fakeResponse() {
  const headers = new Map<string, string>();
  const res = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return res;
    },
  } as unknown as ExpressResponse;
  return { res, headers };
}

function run() {
  const { res, headers } = fakeResponse();
  const next = vi.fn() as unknown as NextFunction;
  securityHeadersMiddleware()({} as ExpressRequest, res, next);
  return { headers, next };
}

describe('securityHeadersMiddleware', () => {
  it('marca toda resposta como não sniffável e não enquadrável', () => {
    const { headers } = run();
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('a CSP da API não permite carregar NADA — ela só devolve JSON', () => {
    const { headers } = run();
    expect(headers.get('Content-Security-Policy')).toContain("default-src 'none'");
  });

  it('respostas autenticadas não podem ficar em cache de proxy', () => {
    const { headers } = run();
    expect(headers.get('Cache-Control')).toBe('no-store');
  });

  it('não interrompe a cadeia: o handler seguinte sempre roda', () => {
    const { next } = run();
    expect(next).toHaveBeenCalledOnce();
  });
});
