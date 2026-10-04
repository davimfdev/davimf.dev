import { describe, it, expect, vi } from 'vitest';
import { ApiError } from '../http';
import { clientIp, enforceRateLimit, enforceRouteRateLimit } from '../rate-limit';

const req = (headers: Record<string, string> = {}) =>
  new Request('https://elf.davimf.dev/api/elf/auth/device/start', { method: 'POST', headers });

/** Banco falso: devolve `hits` e registra o bucket de cada chamada. */
function sqlCom(hits: number) {
  const buckets: unknown[] = [];
  const query = vi.fn(async (_s: TemplateStringsArray, ...values: unknown[]) => {
    buckets.push(values[0]);
    return [{ hits }];
  });
  return { query, buckets };
}

describe('clientIp', () => {
  it('usa o X-Real-IP que o Nginx Proxy Manager define', () => {
    expect(clientIp(req({ 'x-real-ip': '177.1.2.3' }))).toBe('177.1.2.3');
  });
  it('ignora X-Forwarded-For, que o cliente pode forjar', () => {
    expect(clientIp(req({ 'x-forwarded-for': '9.9.9.9' }))).toBe('unknown');
  });
  it('não deixa X-Forwarded-For sobrepor o X-Real-IP', () => {
    expect(clientIp(req({ 'x-real-ip': '177.1.2.3', 'x-forwarded-for': '9.9.9.9' }))).toBe(
      '177.1.2.3',
    );
  });
  it('devolve unknown quando não há fonte confiável', () => {
    expect(clientIp(req())).toBe('unknown');
  });
});

describe('enforceRateLimit', () => {
  const limite = { scope: 'device_start', identifier: '1.1.1.1', limit: 5, windowSeconds: 600 };

  it('deixa passar abaixo do limite', async () => {
    const { query } = sqlCom(3);
    await expect(
      enforceRateLimit(limite, { sql: query as never, random: () => 0.5 }),
    ).resolves.toBeUndefined();
  });

  it('deixa passar exatamente no limite', async () => {
    const { query } = sqlCom(5);
    await expect(
      enforceRateLimit(limite, { sql: query as never, random: () => 0.5 }),
    ).resolves.toBeUndefined();
  });

  it('bloqueia acima do limite com RATE_LIMITED e Retry-After positivo', async () => {
    const { query } = sqlCom(6);
    const error: unknown = await enforceRateLimit(limite, {
      sql: query as never,
      random: () => 0.5,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const api = error as ApiError;
    expect(api.code).toBe('RATE_LIMITED');
    expect(api.status).toBe(429);
    expect(api.extra?.retryAfterSeconds).toBeGreaterThan(0);
    expect(api.extra?.retryAfterSeconds).toBeLessThanOrEqual(600);
  });

  it('inclui o início da janela no bucket, para o contador expirar sozinho', async () => {
    const { query, buckets } = sqlCom(1);
    await enforceRateLimit(limite, { sql: query as never, random: () => 0.5 });
    expect(String(buckets[0])).toMatch(/^device_start:1\.1\.1\.1:\d+$/);
  });

  it('dispara a limpeza em uma fração das chamadas', async () => {
    const { query } = sqlCom(1);
    await enforceRateLimit(limite, { sql: query as never, random: () => 0.001 });
    expect(String(query.mock.calls[1]?.[0])).toContain('DELETE FROM rate_limits');
  });

  it('não dispara a limpeza na maioria das chamadas', async () => {
    const { query } = sqlCom(1);
    await enforceRateLimit(limite, { sql: query as never, random: () => 0.9 });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('falha alto se o banco não devolver a contagem, em vez de liberar', async () => {
    const query = vi.fn(async () => []);
    await expect(
      enforceRateLimit(limite, { sql: query as never, random: () => 0.9 }),
    ).rejects.toThrow('contagem');
  });
});

describe('enforceRouteRateLimit', () => {
  const get = () => new Request('https://elf.davimf.dev/api/elf/auth/sessions');
  const del = () => new Request('https://elf.davimf.dev/api/elf/auth/sessions/x', { method: 'DELETE' });

  it('usa o bucket de leitura em GET', async () => {
    const { query, buckets } = sqlCom(1);
    await enforceRouteRateLimit(get(), 'user-1', { sql: query as never, random: () => 0.9 });
    expect(String(buckets[0])).toMatch(/^read:user-1:/);
  });

  it('usa o bucket de escrita em DELETE', async () => {
    const { query, buckets } = sqlCom(1);
    await enforceRouteRateLimit(del(), 'user-1', { sql: query as never, random: () => 0.9 });
    expect(String(buckets[0])).toMatch(/^write:user-1:/);
  });

  it('bloqueia escrita acima de 120 por minuto', async () => {
    const { query } = sqlCom(121);
    await expect(
      enforceRouteRateLimit(del(), 'user-1', { sql: query as never, random: () => 0.9 }),
    ).rejects.toThrow(ApiError);
  });
});
