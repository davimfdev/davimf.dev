import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';

/**
 * O ping do FMM conta instalações da versão gratuita, que não tem chave de
 * licença. Estes testes cobrem as duas coisas que a rota precisa garantir:
 * que contagem forjada não entra, e que o corpo aceito não carrega nada além
 * do já documentado.
 */
const SEGREDO = 'segredo-de-teste';
const HWID = 'a'.repeat(64);

const consultas: Array<{ query: string; values: unknown[] }> = [];

vi.mock('../lib/fmm-license.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/fmm-license.js')>();
  return {
    ...original,
    // Só o banco é falso; a verificação de assinatura roda de verdade.
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
      consultas.push({ query: strings.join(' ').replace(/\s+/g, ' ').trim(), values });
      return Promise.resolve([]);
    },
  };
});

const { default: ping } = await import('../fmm-ping');

function assinar(hwid: string, timestamp: string): string {
  // Mesmo esquema das rotas de licença, com key_hash vazio: instalação
  // gratuita não tem chave. Ver signTelemetryPayload em telemetry.go.
  return createHmac('sha256', SEGREDO).update(`:${hwid}:${timestamp}`).digest('hex');
}

function requisicao(corpo: Record<string, unknown>): Request {
  return new Request('https://davimf.dev/api/fmm-ping', {
    method: 'POST',
    body: JSON.stringify(corpo),
  });
}

function corpoValido(overrides: Record<string, unknown> = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return {
    hwid_hash: HWID,
    version: 'v1.2.3',
    level: 'free',
    timestamp,
    hmac: assinar(HWID, timestamp),
    ...overrides,
  };
}

describe('fmm-ping', () => {
  beforeEach(() => {
    process.env.FMM_APP_SECRET = SEGREDO;
    consultas.length = 0;
  });

  afterEach(() => {
    delete process.env.FMM_APP_SECRET;
  });

  it('registra a instalação quando a assinatura confere', async () => {
    const resposta = await ping(requisicao(corpoValido()));

    expect(resposta.status).toBe(200);
    expect(consultas).toHaveLength(1);
    expect(consultas[0].query).toContain('INSERT INTO fmm_installs');
    expect(consultas[0].query).toContain('ON CONFLICT');
    expect(consultas[0].values).toEqual([HWID, 'v1.2.3', 'free']);
  });

  it('recusa ping sem assinatura válida e não grava nada', async () => {
    const resposta = await ping(requisicao(corpoValido({ hmac: 'f'.repeat(64) })));

    expect(resposta.status).toBe(401);
    expect(consultas).toHaveLength(0);
  });

  it('recusa assinatura de outro HWID, para não inflar a contagem', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const resposta = await ping(
      requisicao({ ...corpoValido(), timestamp, hmac: assinar('b'.repeat(64), timestamp) })
    );

    expect(resposta.status).toBe(401);
    expect(consultas).toHaveLength(0);
  });

  it('recusa hwid_hash que não seja SHA-256 em hex', async () => {
    const resposta = await ping(requisicao(corpoValido({ hwid_hash: 'nao-e-hash' })));

    expect(resposta.status).toBe(400);
    expect(consultas).toHaveLength(0);
  });

  it('normaliza nível desconhecido para free e limita o tamanho da versão', async () => {
    await ping(requisicao(corpoValido({ level: 'inventado', version: 'x'.repeat(200) })));

    const [hwid, versao, nivel] = consultas[0].values as string[];
    expect(hwid).toBe(HWID);
    expect(nivel).toBe('free');
    expect(versao).toHaveLength(32);
  });

  it('aceita apenas POST', async () => {
    const resposta = await ping(
      new Request('https://davimf.dev/api/fmm-ping', { method: 'GET' })
    );

    expect(resposta.status).toBe(405);
    expect(consultas).toHaveLength(0);
  });
});
