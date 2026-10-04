import { describe, it, expect, vi } from 'vitest';
import { writeAudit } from '../audit';

const txFalso = () => vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>>(async () => []);

const valoresDe = (tx: ReturnType<typeof txFalso>) => tx.mock.calls[0]?.slice(1) ?? [];

describe('writeAudit', () => {
  it('grava na tabela de auditoria', async () => {
    const tx = txFalso();
    await writeAudit(tx as never, {
      userId: 'user-1',
      deviceId: 'dev-1',
      entity: 'device',
      entityId: 'dev-1',
      action: 'approve',
    });
    expect(tx.mock.calls[0]?.[0].join('?')).toContain('INSERT INTO audit_logs');
  });

  it('passa before e after como objeto, não como string JSON', async () => {
    const tx = txFalso();
    await writeAudit(tx as never, {
      userId: 'user-1',
      deviceId: 'dev-1',
      entity: 'device',
      entityId: 'dev-1',
      action: 'update',
      before: { name: 'Antigo' },
      after: { name: 'Novo' },
    });
    const valores = valoresDe(tx);
    expect(valores).toContainEqual({ name: 'Antigo' });
    expect(valores).toContainEqual({ name: 'Novo' });
    expect(valores).not.toContain(JSON.stringify({ name: 'Novo' }));
  });

  it('guarda as versões fora do JSON, para consulta direta', async () => {
    const tx = txFalso();
    await writeAudit(tx as never, {
      userId: 'user-1',
      deviceId: 'dev-1',
      entity: 'account',
      entityId: 'acc-1',
      action: 'update',
      versionBefore: 3,
      versionAfter: 4,
    });
    expect(valoresDe(tx)).toEqual(
      expect.arrayContaining([3, 4]),
    );
  });

  it('usa origin manual por padrão', async () => {
    const tx = txFalso();
    await writeAudit(tx as never, {
      userId: 'user-1',
      deviceId: 'dev-1',
      entity: 'device',
      entityId: 'dev-1',
      action: 'revoke',
    });
    expect(valoresDe(tx)).toContain('manual');
  });

  it('aceita deviceId nulo e grava null quando before e after faltam', async () => {
    const tx = txFalso();
    await writeAudit(tx as never, {
      userId: 'user-1',
      deviceId: null,
      entity: 'session',
      entityId: 'sess-1',
      action: 'revoke',
      origin: 'system',
    });
    const valores = valoresDe(tx);
    expect(valores[1]).toBeNull();
    expect(valores[5]).toBeNull();
    expect(valores[6]).toBeNull();
  });
});
