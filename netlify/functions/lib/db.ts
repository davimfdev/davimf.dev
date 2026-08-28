/**
 * Acesso a PostgreSQL por TCP, com pool — substitui o driver HTTP da Neon
 * (`@neondatabase/serverless` / `@netlify/neon`), que fazia `fetch` para um
 * endpoint da Neon e passou a falhar com ECONNREFUSED depois da migração para
 * o VPS, onde o banco é um Postgres 17 comum em `postgres:5432`.
 *
 * Escolhemos **postgres.js** porque a API é a mesma template tag que os ~25
 * handlers já usam (`await sql\`SELECT ...\`` devolve um array de linhas), o que
 * mantém TODA a query existente byte a byte. Com `pg` seria preciso reescrever
 * cada query para `$1` + `.rows`.
 *
 * ### Um pool por connection string
 *
 * Vários handlers criavam o cliente DENTRO do handler (`const sql = neon(...)`).
 * Com HTTP isso era grátis; com TCP, criar um cliente por requisição vazaria
 * conexões até esgotar o `max_connections` do servidor. Por isso os clientes são
 * memoizados pela connection string: duas variáveis de ambiente apontando para
 * a mesma URL compartilham o mesmo pool.
 *
 * ### Compatibilidade de comportamento com o driver antigo
 *
 * - `transform: { undefined: null }` — o driver da Neon (via `pg`) mandava
 *   `undefined` como NULL; o postgres.js, sem isso, lança `UNDEFINED_VALUE`.
 *   Há queries que dependem disso (ex.: `accounts.ts` interpola `${body.type}`
 *   direto do corpo da requisição).
 * - Os parsers padrão coincidem: `int8`/`numeric` viram string, `jsonb` vira
 *   objeto, `timestamptz` vira `Date`, `bool` vira boolean.
 */

import postgres from 'postgres';

export type SqlRow = Record<string, unknown>;

/** Assinatura que todos os handlers já usam. */
export type SqlClient = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<SqlRow[]>;

type PostgresClient = ReturnType<typeof postgres>;

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

/**
 * Prepared statements ficam ligados (é o padrão e o mais rápido em Postgres
 * nativo). Atrás de um PgBouncer em modo `transaction` eles quebram, então
 * `DB_PREPARE=false` (ou `PGBOUNCER=true`) desliga.
 */
function preparedStatementsEnabled(): boolean {
  if (process.env.PGBOUNCER === 'true') return false;
  return process.env.DB_PREPARE !== 'false';
}

const pools = new Map<string, PostgresClient>();

/** Configuração do pool. Exportada para o teste conferir os pontos críticos. */
export function poolOptions() {
  return {
    max: intFromEnv('DB_POOL_MAX', 10),
    idle_timeout: intFromEnv('DB_IDLE_TIMEOUT', 30),
    connect_timeout: intFromEnv('DB_CONNECT_TIMEOUT', 10),
    max_lifetime: intFromEnv('DB_MAX_LIFETIME', 60 * 30),
    prepare: preparedStatementsEnabled(),
    // Preserva o comportamento do driver antigo (undefined → NULL). Sem isto o
    // postgres.js lança UNDEFINED_VALUE e handlers como accounts.ts, que
    // interpolam campos crus do corpo da requisição, passariam a quebrar.
    transform: { undefined: null },
    // `CREATE TABLE IF NOT EXISTS` e afins emitem NOTICE a cada chamada; sem
    // isto o log de produção vira ruído.
    onnotice: process.env.DB_LOG_NOTICES === 'true' ? undefined : () => {},
  };
}

function createPool(connectionString: string): PostgresClient {
  return postgres(connectionString, poolOptions());
}

/** Resolve a primeira variável preenchida da lista. */
function connectionStringFrom(envNames: readonly string[]): string {
  for (const name of envNames) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Defina uma destas variáveis de ambiente: ${envNames.join(' ou ')}`);
}

/**
 * Cliente memoizado para um conjunto de variáveis de ambiente.
 *
 * A resolução é PREGUIÇOSA: nada acontece no import, então um módulo pode ser
 * importado (inclusive por um teste) sem que a env var exista. O postgres.js
 * também só abre socket na primeira query.
 */
export function sqlFor(envNames: readonly string[]): SqlClient {
  return (strings, ...values) => {
    const connectionString = connectionStringFrom(envNames);
    let pool = pools.get(connectionString);
    if (!pool) {
      pool = createPool(connectionString);
      pools.set(connectionString, pool);
    }
    // O tipo público do postgres.js é paramétrico no schema; aqui a assinatura
    // é a genérica que todos os handlers já usavam.
    const tagged = pool as unknown as SqlClient;
    return tagged(strings, ...values);
  };
}

// ------------------------------------------------------------- bancos ------
//
// São bancos SEPARADOS e não devem ser unificados.

/**
 * Banco do site (`davimf_dev`) — todo, notas, encurtador, contas.
 * Precedência histórica destes handlers: `DATABASE_URL` primeiro.
 */
export const SITE_DB_ENV = ['DATABASE_URL', 'NETLIFY_DATABASE_URL'] as const;

/**
 * Mesmo banco do site, mas pela ótica dos handlers de auth/FMM/pagamentos, que
 * sempre leram `NETLIFY_DATABASE_URL` primeiro.
 *
 * As duas listas existem de propósito: se as duas variáveis apontarem para a
 * MESMA URL (o caso normal hoje), o pool é literalmente o mesmo objeto. Se
 * apontarem para bancos diferentes, cada handler continua indo para o banco em
 * que os dados dele estão — unificar aqui poderia fazer tabela "sumir".
 */
export const AUTH_DB_ENV = ['NETLIFY_DATABASE_URL', 'DATABASE_URL'] as const;

/** Banco de configuração do bot (`bot_configs`). */
export const BOT_DB_ENV = ['POSTGRES_URL', 'BOT_CONFIG_DATABASE_URL'] as const;

/** Banco de tickets. */
export const TICKETS_DB_ENV = ['TICKETS_NEON', 'TICKETS_DATABASE_URL'] as const;

export const siteDbSql = sqlFor(SITE_DB_ENV);
export const authDbSql = sqlFor(AUTH_DB_ENV);
export const botDbSql = sqlFor(BOT_DB_ENV);
export const ticketsDbSql = sqlFor(TICKETS_DB_ENV);

// ------------------------------------------------------------ diagnóstico --

export type DatabaseTarget = {
  label: string;
  envVar: string | null;
  host: string | null;
  database: string | null;
};

/**
 * Para onde cada acessor aponta, SEM credencial — só host, porta e nome do
 * banco. Existe porque "relation ... does not exist" quase sempre significa
 * que a migração foi aplicada num banco e a aplicação está lendo outro; sem
 * isto impresso no arranque, descobrir isso é adivinhação.
 */
export function describeDatabases(): DatabaseTarget[] {
  const targets: Array<[string, readonly string[]]> = [
    ['site (davimf_dev)', SITE_DB_ENV],
    ['auth/FMM/pagamentos', AUTH_DB_ENV],
    ['bot (bot_configs)', BOT_DB_ENV],
    ['tickets', TICKETS_DB_ENV],
  ];

  return targets.map(([label, envNames]) => {
    const envVar = envNames.find((name) => process.env[name]?.trim()) ?? null;
    const raw = envVar ? process.env[envVar]!.trim() : null;
    if (!raw) return { label, envVar: null, host: null, database: null };
    try {
      const parsed = new URL(raw);
      return {
        label,
        envVar,
        host: `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`,
        database: parsed.pathname.replace(/^\//, '') || null,
      };
    } catch {
      // Connection string em formato keyword/value: não dá para parsear como URL.
      return { label, envVar, host: null, database: null };
    }
  });
}

/** Código SQLSTATE de "relation does not exist". */
export const UNDEFINED_TABLE = '42P01';

/** `true` quando o erro é de tabela inexistente (migração não aplicada). */
export function isMissingRelationError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === UNDEFINED_TABLE;
}

// --------------------------------------------------------- ciclo de vida ---

/** Fecha os pools no encerramento do processo (SIGTERM/SIGINT). */
export async function closeAllPools(timeoutSeconds = 5): Promise<void> {
  const open = [...pools.values()];
  pools.clear();
  await Promise.allSettled(open.map((pool) => pool.end({ timeout: timeoutSeconds })));
}

/** Diagnóstico: quantos pools estão abertos. Usado nos testes. */
export function openPoolCount(): number {
  return pools.size;
}

/** Só para testes: descarta os pools memoizados sem tocar em sockets. */
export function resetPoolsForTesting(): void {
  pools.clear();
}
