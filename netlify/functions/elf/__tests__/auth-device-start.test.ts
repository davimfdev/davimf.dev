import { describe, it, expect, vi } from 'vitest';
import { ApiError, withElf } from '../lib/http';
import { handleDeviceStart } from '../auth-device-start';

const req = (body: unknown, method = 'POST') =>
  new Request('https://elf.davimf.dev/api/elf/auth/device/start', {
    method,
    headers: { 'Content-Type': 'application/json', 'x-real-ip': '177.1.2.3' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });

const corpoOk = { deviceName: 'Notebook do Davi', platform: 'desktop' };

function depsOk() {
  const gravado: unknown[][] = [];
  const sql = vi.fn(async (_s: TemplateStringsArray, ...values: unknown[]) => {
    gravado.push(values);
    return [];
  });
  const enforceRateLimit = vi.fn(async () => {});
  return { sql, enforceRateLimit, gravado };
}

const run = (request: Request, deps: Partial<ReturnType<typeof depsOk>>) =>
  withElf((r) => handleDeviceStart(r, deps as never))(request);

type StartBody = { code: string; pollToken: string; expiresAt: string; verificationUrl: string };

describe('handleDeviceStart', () => {
  it('cria o pareamento e devolve código, pollToken e URL de verificação', async () => {
    const res = await run(req(corpoOk), depsOk());
    expect(res.status).toBe(201);
    const body = (await res.json()) as StartBody;
    expect(body.code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    expect(body.pollToken.split('.')).toHaveLength(2);
    expect(body.verificationUrl).toBe('https://elf.davimf.dev/parear');
  });

  it('expira em 5 minutos', async () => {
    const res = await run(req(corpoOk), depsOk());
    const { expiresAt } = (await res.json()) as StartBody;
    const minutos = (new Date(expiresAt).getTime() - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(4.9);
    expect(minutos).toBeLessThanOrEqual(5);
  });

  it('grava apenas os hashes, nunca o código nem o pollToken em claro', async () => {
    const deps = depsOk();
    const res = await run(req(corpoOk), deps);
    const body = (await res.json()) as StartBody;
    const texto = JSON.stringify(deps.gravado);
    expect(texto).not.toContain(body.code.replace('-', ''));
    expect(texto).not.toContain(body.pollToken.split('.')[0]);
    expect(deps.gravado[0]).toEqual(
      expect.arrayContaining(['Notebook do Davi', 'desktop']),
    );
  });

  it('limita por IP do cliente', async () => {
    const deps = depsOk();
    await run(req(corpoOk), deps);
    expect(deps.enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'device_start', identifier: '177.1.2.3', limit: 5 }),
    );
  });

  it('recusa plataforma web', async () => {
    const res = await run(req({ deviceName: 'Chrome', platform: 'web' }), depsOk());
    expect(res.status).toBe(400);
  });

  it('recusa nome vazio ou só com espaços', async () => {
    const res = await run(req({ deviceName: '   ', platform: 'desktop' }), depsOk());
    expect(res.status).toBe(400);
  });

  it('recusa campo desconhecido, como um userId vindo do cliente', async () => {
    const deps = depsOk();
    const res = await run(req({ ...corpoOk, userId: 'de-outro' }), deps);
    expect(res.status).toBe(400);
    expect(deps.sql).not.toHaveBeenCalled();
  });

  it('propaga o rate limit como 429 com Retry-After, sem gravar', async () => {
    const deps = depsOk();
    deps.enforceRateLimit.mockRejectedValueOnce(
      new ApiError('RATE_LIMITED', 'Muitas requisições.', 429, { retryAfterSeconds: 60 }),
    );
    const res = await run(req(corpoOk), deps);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(deps.sql).not.toHaveBeenCalled();
  });

  it('recusa método diferente de POST', async () => {
    const res = await run(req(null, 'GET'), depsOk());
    expect(res.status).toBe(400);
  });
});
