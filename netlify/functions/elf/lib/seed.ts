import type { ElfSql } from './db';

export type CategoryKind = 'income' | 'expense' | 'transfer';

export const SYSTEM_CATEGORIES: ReadonlyArray<{
  systemKey: string;
  name: string;
  kind: CategoryKind;
}> = [
  { systemKey: 'food', name: 'Alimentação', kind: 'expense' },
  { systemKey: 'home_supplies', name: 'Compras para casa', kind: 'expense' },
  { systemKey: 'housing', name: 'Moradia', kind: 'expense' },
  { systemKey: 'transport', name: 'Transporte', kind: 'expense' },
  { systemKey: 'health', name: 'Saúde', kind: 'expense' },
  { systemKey: 'leisure', name: 'Lazer', kind: 'expense' },
  { systemKey: 'subscriptions', name: 'Assinaturas', kind: 'expense' },
  { systemKey: 'education', name: 'Educação', kind: 'expense' },
  { systemKey: 'gifts', name: 'Presentes', kind: 'expense' },
  { systemKey: 'clothing', name: 'Roupas', kind: 'expense' },
  { systemKey: 'debts', name: 'Dívidas', kind: 'expense' },
  { systemKey: 'investments', name: 'Investimentos', kind: 'expense' },
  { systemKey: 'other', name: 'Outros', kind: 'expense' },
  { systemKey: 'salary', name: 'Salário', kind: 'income' },
  { systemKey: 'side_income', name: 'Renda extra', kind: 'income' },
  { systemKey: 'transfers', name: 'Transferências', kind: 'transfer' },
];

export type SeedInput = { userId: string; deviceId: string; requestId: string };

/**
 * Cria as categorias de sistema que faltarem e devolve quantas foram criadas.
 *
 * Idempotente por constraint, não por consulta prévia: dois callbacks
 * simultâneos passariam os dois por um "já existe?" e criariam o dobro.
 *
 * Roda dentro da transação do login. Por isso a ausência da tabela (que só nasce
 * no Plano 3) é checada antes, com `to_regclass`: deixar o INSERT falhar abortaria
 * a transação inteira no Postgres, e o login junto.
 */
export async function seedSystemCategories(tx: ElfSql, input: SeedInput): Promise<number> {
  const [table] = await tx<{ exists: boolean }>`
    SELECT to_regclass('public.categories') IS NOT NULL AS exists`;
  if (!table?.exists) {
    console.warn('[elf] seed adiado: tabela categories ainda não existe', {
      requestId: input.requestId,
    });
    return 0;
  }

  const keys = SYSTEM_CATEGORIES.map((category) => category.systemKey);
  const names = SYSTEM_CATEGORIES.map((category) => category.name);
  const kinds = SYSTEM_CATEGORIES.map((category) => category.kind);

  const inserted = await tx<{ id: string; name: string; kind: string; system_key: string }>`
    INSERT INTO categories (user_id, name, kind, is_system, system_key, device_id)
    SELECT ${input.userId}, s.name, s.kind, TRUE, s.system_key, ${input.deviceId}
      FROM UNNEST(${keys}::text[], ${names}::text[], ${kinds}::text[]) AS s(system_key, name, kind)
    ON CONFLICT (user_id, system_key) WHERE system_key IS NOT NULL
    DO NOTHING
    RETURNING id, name, kind, system_key`;

  for (const row of inserted) {
    // O objeto vai cru: o postgres.js serializa para jsonb. Passar JSON.stringify(row)
    // gravaria uma string JSON escalar, e after->>'system_key' viraria NULL.
    await tx`
      INSERT INTO audit_logs
        (user_id, device_id, entity, entity_id, action, before, after,
         version_before, version_after, origin, request_id)
      VALUES (${input.userId}, ${input.deviceId}, 'category', ${row.id}, 'create', NULL,
              ${row}::jsonb, NULL, 1, 'system', ${input.requestId})`;
  }

  return inserted.length;
}
