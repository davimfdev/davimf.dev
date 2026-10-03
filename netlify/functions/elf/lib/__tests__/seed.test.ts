import { describe, it, expect, vi } from 'vitest';
import { SYSTEM_CATEGORIES, seedSystemCategories } from '../seed';

const INPUT = { userId: 'user-1', deviceId: 'dev-1', requestId: 'req-1' };

/** Simula o banco: responde à checagem da tabela e ao INSERT de categorias. */
function txQue(options: { tableExists: boolean; created: Array<{ id: string; name: string }> }) {
  return vi.fn(async (strings: TemplateStringsArray) => {
    const text = strings.join('?');
    if (text.includes('to_regclass')) return [{ exists: options.tableExists }];
    if (text.includes('INSERT INTO categories')) return options.created;
    return [];
  });
}

const auditoriasDe = (tx: ReturnType<typeof txQue>) =>
  tx.mock.calls.filter(([strings]) => strings.join('?').includes('INSERT INTO audit_logs'));

describe('SYSTEM_CATEGORIES', () => {
  it('tem 16 categorias', () => {
    expect(SYSTEM_CATEGORIES).toHaveLength(16);
  });
  it('tem system_key único', () => {
    const chaves = SYSTEM_CATEGORIES.map((c) => c.systemKey);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
  it('inclui a categoria de transferência', () => {
    expect(SYSTEM_CATEGORIES.find((c) => c.systemKey === 'transfers')?.kind).toBe('transfer');
  });
  it('tem exatamente duas categorias de receita', () => {
    expect(SYSTEM_CATEGORIES.filter((c) => c.kind === 'income')).toHaveLength(2);
  });
});

describe('seedSystemCategories', () => {
  it('audita uma linha por categoria criada', async () => {
    const criadas = SYSTEM_CATEGORIES.map((c, i) => ({ id: `cat-${i}`, name: c.name }));
    const tx = txQue({ tableExists: true, created: criadas });
    expect(await seedSystemCategories(tx as never, INPUT)).toBe(16);
    expect(auditoriasDe(tx)).toHaveLength(16);
  });

  it('grava o after da auditoria como objeto, não como string JSON', async () => {
    const criada = { id: 'cat-0', name: 'Alimentação' };
    const tx = txQue({ tableExists: true, created: [criada] });
    await seedSystemCategories(tx as never, INPUT);
    const [auditoria] = auditoriasDe(tx);
    expect(auditoria?.slice(1)).toContainEqual(criada);
    expect(auditoria?.slice(1)).not.toContain(JSON.stringify(criada));
  });

  it('não audita nada quando o ON CONFLICT descarta tudo', async () => {
    const tx = txQue({ tableExists: true, created: [] });
    expect(await seedSystemCategories(tx as never, INPUT)).toBe(0);
    expect(auditoriasDe(tx)).toHaveLength(0);
  });

  it('grava com o usuário e o dispositivo do login', async () => {
    const tx = txQue({ tableExists: true, created: [] });
    await seedSystemCategories(tx as never, INPUT);
    const insert = tx.mock.calls.find(([strings]) =>
      strings.join('?').includes('INSERT INTO categories'),
    );
    expect(insert?.slice(1, 3)).toEqual(['user-1', 'dev-1']);
  });

  it('não tenta inserir antes de a tabela existir, para não abortar a transação do login', async () => {
    const tx = txQue({ tableExists: false, created: [] });
    expect(await seedSystemCategories(tx as never, INPUT)).toBe(0);
    expect(tx).toHaveBeenCalledTimes(1);
  });
});
