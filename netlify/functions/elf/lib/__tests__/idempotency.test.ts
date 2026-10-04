import { describe, it, expect, vi } from 'vitest';
import { ApiError } from '../http';
import { stableStringify, requestHash, acquireIdempotency, recordIdempotency } from '../idempotency';

describe('stableStringify', () => {
  it('ordena as chaves', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
  it('ordena recursivamente', () => {
    expect(stableStringify({ x: { b: 1, a: 2 } })).toBe('{"x":{"a":2,"b":1}}');
  });
  it('preserva a ordem de arrays', () => {
    expect(stableStringify([2, 1])).toBe('[2,1]');
  });
  it('distingue valores diferentes', () => {
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
  });
});

describe('requestHash', () => {
  it('é igual para o mesmo corpo em ordem diferente', () => {
    expect(requestHash({ accountId: 'x', amountCents: 100 })).toBe(
      requestHash({ amountCents: 100, accountId: 'x' }),
    );
  });
  it('difere para corpos diferentes', () => {
    expect(requestHash({ amountCents: 100 })).not.toBe(requestHash({ amountCents: 101 }));
  });
});

const entrada = { userId: 'user-1', endpoint: 'POST:/api/elf/transfers', key: 'k1', hash: 'h1' };

/** Transação falsa: o SELECT de idempotency_keys devolve `rows`, o resto devolve vazio. */
function txCom(rows: unknown[], falhaNoLock?: Error) {
  return vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>>(async (strings) => {
    const text = strings.join('?');
    if (falhaNoLock && text.includes('pg_advisory_xact_lock')) throw falhaNoLock;
    return text.includes('FROM idempotency_keys') ? rows : [];
  });
}

const textos = (tx: ReturnType<typeof txCom>) => tx.mock.calls.map(([s]) => s.join('?'));

describe('acquireIdempotency', () => {
  it('define o timeout, toma o advisory lock e só então consulta', async () => {
    const tx = txCom([]);
    await acquireIdempotency(tx as never, entrada);
    const [timeout, lock, select] = textos(tx);
    expect(timeout).toContain('lock_timeout');
    expect(lock).toContain('pg_advisory_xact_lock');
    expect(select).toContain('FROM idempotency_keys');
  });

  it('usa usuário, endpoint e chave no lock', async () => {
    const tx = txCom([]);
    await acquireIdempotency(tx as never, entrada);
    expect(tx.mock.calls[1]?.slice(1)).toEqual(['user-1', 'POST:/api/elf/transfers', 'k1']);
  });

  it('devolve replay nulo quando a chave é inédita', async () => {
    expect(await acquireIdempotency(txCom([]) as never, entrada)).toEqual({ replay: null });
  });

  it('devolve a resposta gravada quando o hash bate', async () => {
    const tx = txCom([{ request_hash: 'h1', response_status: 201, response_body: { id: 'tx-1' } }]);
    expect(await acquireIdempotency(tx as never, entrada)).toEqual({
      replay: { status: 201, body: { id: 'tx-1' } },
    });
  });

  it('lança IDEMPOTENCY_MISMATCH quando o hash diverge', async () => {
    const tx = txCom([{ request_hash: 'outro', response_status: 201, response_body: {} }]);
    await expect(acquireIdempotency(tx as never, entrada)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_MISMATCH',
      status: 409,
    });
  });

  it('traduz lock_timeout (55P03) em IDEMPOTENCY_IN_PROGRESS', async () => {
    const timeout = Object.assign(new Error('canceling statement due to lock timeout'), {
      code: '55P03',
    });
    const error: unknown = await acquireIdempotency(txCom([], timeout) as never, entrada).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'IDEMPOTENCY_IN_PROGRESS',
      status: 409,
      extra: { retryAfterSeconds: 2 },
    });
  });

  it('propaga outros erros do banco sem disfarçar', async () => {
    const outro = Object.assign(new Error('conexão caiu'), { code: '08006' });
    await expect(acquireIdempotency(txCom([], outro) as never, entrada)).rejects.toBe(outro);
  });
});

describe('recordIdempotency', () => {
  it('grava status e corpo como objeto', async () => {
    const tx = txCom([]);
    await recordIdempotency(tx as never, { ...entrada, status: 201, body: { id: 'tx-1' } });
    expect(textos(tx)[0]).toContain('INSERT INTO idempotency_keys');
    expect(tx.mock.calls[0]?.slice(1)).toEqual([
      'k1',
      'user-1',
      'POST:/api/elf/transfers',
      'h1',
      201,
      { id: 'tx-1' },
    ]);
  });
});
