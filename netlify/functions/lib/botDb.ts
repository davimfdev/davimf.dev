// Banco de CONFIG DO BOT (`bot_configs`) — projeto separado do banco do site
// (`davimf_dev`). Só server-side.
//
// Conexão TCP com pool via lib/db.ts. A inicialização continua PREGUIÇOSA: o
// cliente real só é criado na primeira query, então importar este módulo sem a
// env var configurada (como os testes fazem, injetando `sql`) segue funcionando.
// O uso `botSql`...`` é idêntico ao de antes para todos os callers.
import { botDbSql } from './db';

export type SqlRow = Record<string, unknown>;
export type DashboardSql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<SqlRow[]>;

export const botSql: DashboardSql = botDbSql;
