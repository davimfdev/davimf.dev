import { describe, it, expect, vi } from 'vitest';
import { signToken } from '../crypto';
import { resolveWebDevice, deviceNameFromUserAgent, ELF_DEVICE_COOKIE } from '../device';

const cookieCom = (deviceId: string) => `${ELF_DEVICE_COOKIE}=${signToken(deviceId)}`;

describe('deviceNameFromUserAgent', () => {
  it('reconhece Chrome no Windows', () => {
    const nome = deviceNameFromUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
    );
    expect(nome).toBe('Chrome no Windows');
  });
  it('reconhece Edge antes de Chrome', () => {
    const nome = deviceNameFromUserAgent(
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0',
    );
    expect(nome).toBe('Edge no Windows');
  });
  it('usa rótulo genérico quando não reconhece', () => {
    expect(deviceNameFromUserAgent('agente-desconhecido')).toBe('Navegador');
  });
  it('lida com User-Agent ausente', () => {
    expect(deviceNameFromUserAgent(null)).toBe('Navegador');
  });
});

describe('resolveWebDevice', () => {
  it('cria dispositivo quando não há cookie', async () => {
    const query = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => [{ id: 'novo-dev' }]);
    const res = await resolveWebDevice(
      { userId: 'user-1', cookieHeader: null, userAgent: null },
      { sql: query as never },
    );
    expect(res).toEqual({ deviceId: 'novo-dev', isNew: true });
    expect(String(query.mock.calls[0]?.[0])).toContain('INSERT INTO devices');
  });

  it('reutiliza dispositivo válido do cookie', async () => {
    const query = vi.fn(async () => [{ id: 'dev-existente' }]);
    const res = await resolveWebDevice(
      { userId: 'user-1', cookieHeader: cookieCom('dev-existente'), userAgent: null },
      { sql: query as never },
    );
    expect(res).toEqual({ deviceId: 'dev-existente', isNew: false });
    expect(query.mock.calls[0]?.slice(1)).toEqual(['dev-existente', 'user-1']);
  });

  it('ignora cookie de dispositivo de outro usuário', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'novo-dev' }]);
    const res = await resolveWebDevice(
      { userId: 'user-2', cookieHeader: cookieCom('dev-do-user-1'), userAgent: null },
      { sql: query as never },
    );
    expect(res).toEqual({ deviceId: 'novo-dev', isNew: true });
  });

  it('ignora cookie com HMAC adulterado sem consultar o dispositivo', async () => {
    const query = vi.fn(async () => [{ id: 'novo-dev' }]);
    const res = await resolveWebDevice(
      { userId: 'user-1', cookieHeader: `${ELF_DEVICE_COOKIE}=invalido.assinatura`, userAgent: null },
      { sql: query as never },
    );
    expect(res).toEqual({ deviceId: 'novo-dev', isNew: true });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('cria novo quando o dispositivo do cookie está revogado', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'novo-dev' }]);
    const res = await resolveWebDevice(
      { userId: 'user-1', cookieHeader: cookieCom('dev-revogado'), userAgent: null },
      { sql: query as never },
    );
    expect(res).toEqual({ deviceId: 'novo-dev', isNew: true });
  });
});
