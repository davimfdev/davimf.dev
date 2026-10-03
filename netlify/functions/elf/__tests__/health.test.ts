import { describe, it, expect } from 'vitest';
import { handleHealth } from '../health';

const req = () => new Request('https://elf.davimf.dev/api/elf/health');

describe('handleHealth', () => {
  it('responde 200 quando o banco responde', async () => {
    const res = await handleHealth(req(), { sql: (async () => [{ ok: 1 }]) as never });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('responde 503 quando o banco falha', async () => {
    const res = await handleHealth(req(), {
      sql: (async () => {
        throw new Error('conexão recusada');
      }) as never,
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'degraded', database: 'error' });
  });

  it('responde 503 quando ELF_DATABASE_URL falta, que lança antes da query', async () => {
    const res = await handleHealth(req(), {
      sql: (() => {
        throw new Error('Defina uma destas variáveis de ambiente: ELF_DATABASE_URL');
      }) as never,
    });
    expect(res.status).toBe(503);
  });

  it('não vaza o detalhe técnico do erro do banco', async () => {
    const res = await handleHealth(req(), {
      sql: (async () => {
        throw new Error('relation "elf_sessions" does not exist');
      }) as never,
    });
    expect(JSON.stringify(await res.json())).not.toContain('elf_sessions');
  });
});
