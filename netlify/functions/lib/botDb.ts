import { neon } from '@neondatabase/serverless';

// Neon de CONFIG DO BOT — projeto separado do banco do site (DATABASE_URL). Só server-side.
//
// Inicialização PREGUIÇOSA: `neon(url!)` valida a env var na hora da chamada, então criá-lo no
// escopo do módulo lançaria no *import* quando BOT_CONFIG_DATABASE_URL está ausente — o que
// quebraria testes que só importam este módulo (mesmo injetando `sql`). Aqui o cliente real só
// é criado na primeira query; o uso `botSql\`...\`` continua idêntico para os callers.
export type SqlRow = Record<string, unknown>;
export type DashboardSql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<SqlRow[]>;

type NeonSql = ReturnType<typeof neon>;

let cached: NeonSql | null = null;

function client(): NeonSql {
  return (cached ??= neon(process.env.BOT_CONFIG_DATABASE_URL!));
}

export const botSql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  client()(strings, ...values) as Promise<SqlRow[]>) as DashboardSql;
