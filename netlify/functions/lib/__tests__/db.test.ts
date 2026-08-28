/**
 * Camada de acesso a Postgres por TCP.
 *
 * Estes testes não conectam em banco nenhum: exercitam a resolução de env var,
 * a memoização do pool e a compatibilidade da template tag. O que importa aqui
 * é justamente o que mudou de HTTP para TCP — criar um cliente por requisição
 * era grátis antes e vazaria conexões agora.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AUTH_DB_ENV,
  BOT_DB_ENV,
  SITE_DB_ENV,
  TICKETS_DB_ENV,
  openPoolCount,
  poolOptions,
  resetPoolsForTesting,
  sqlFor,
} from '../db';

const TOUCHED = [
  'DATABASE_URL', 'NETLIFY_DATABASE_URL', 'POSTGRES_URL',
  'BOT_CONFIG_DATABASE_URL', 'TICKETS_NEON', 'TICKETS_DATABASE_URL',
  'DB_POOL_MAX', 'PGBOUNCER',
];

const SITE = 'postgres://u:p@postgres:5432/davimf_dev';
const BOT = 'postgres://u:p@postgres:5432/bot_configs';

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(TOUCHED.map((name) => [name, process.env[name]]));
  for (const name of TOUCHED) delete process.env[name];
  resetPoolsForTesting();
});

afterEach(() => {
  for (const name of TOUCHED) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  resetPoolsForTesting();
});

describe('resolução de connection string', () => {
  it('não toca em env var no import nem na criação do cliente', () => {
    // Nenhuma env var definida: só criar o acessor não pode lançar.
    expect(() => sqlFor(SITE_DB_ENV)).not.toThrow();
    expect(openPoolCount()).toBe(0);
  });

  it('só falha quando a query é realmente executada', () => {
    const sql = sqlFor(SITE_DB_ENV);
    // Lança de forma síncrona, como o driver antigo fazia — o `await` dentro do
    // try/catch de cada handler captura igual.
    expect(() => sql`SELECT 1`).toThrow(/DATABASE_URL/);
  });

  it('a mensagem de erro lista todos os nomes aceitos', () => {
    const sql = sqlFor(BOT_DB_ENV);
    expect(() => sql`SELECT 1`).toThrow(/POSTGRES_URL ou BOT_CONFIG_DATABASE_URL/);
  });

  it('DATABASE_URL atende o banco do site', () => {
    process.env.DATABASE_URL = SITE;
    const sql = sqlFor(SITE_DB_ENV);
    void sql`SELECT 1`.catch(() => undefined);
    expect(openPoolCount()).toBe(1);
  });

  it('POSTGRES_URL atende o banco do bot', () => {
    process.env.POSTGRES_URL = BOT;
    const sql = sqlFor(BOT_DB_ENV);
    void sql`SELECT 1`.catch(() => undefined);
    expect(openPoolCount()).toBe(1);
  });

  it('nomes herdados continuam funcionando como fallback', () => {
    process.env.BOT_CONFIG_DATABASE_URL = BOT;
    process.env.TICKETS_NEON = 'postgres://u:p@postgres:5432/tickets';
    void sqlFor(BOT_DB_ENV)`SELECT 1`.catch(() => undefined);
    void sqlFor(TICKETS_DB_ENV)`SELECT 1`.catch(() => undefined);
    expect(openPoolCount()).toBe(2);
  });

  it('o nome novo tem precedência sobre o herdado', () => {
    process.env.POSTGRES_URL = BOT;
    process.env.BOT_CONFIG_DATABASE_URL = 'postgres://u:p@antigo:5432/outro';
    void sqlFor(BOT_DB_ENV)`SELECT 1`.catch(() => undefined);
    // Um único pool, e é o da URL nova.
    expect(openPoolCount()).toBe(1);
  });
});

describe('memoização do pool', () => {
  it('reaproveita o pool entre chamadas — um handler não abre conexão por requisição', () => {
    process.env.DATABASE_URL = SITE;
    const sql = sqlFor(SITE_DB_ENV);

    for (let i = 0; i < 25; i += 1) void sql`SELECT 1`.catch(() => undefined);

    expect(openPoolCount()).toBe(1);
  });

  it('acessores recriados a cada requisição compartilham o mesmo pool', () => {
    process.env.DATABASE_URL = SITE;
    // Reproduz `const sql = siteDbSql` dentro do handler, chamado N vezes.
    for (let i = 0; i < 10; i += 1) {
      void sqlFor(SITE_DB_ENV)`SELECT 1`.catch(() => undefined);
    }
    expect(openPoolCount()).toBe(1);
  });

  it('bancos diferentes não compartilham pool — davimf_dev e bot_configs ficam separados', () => {
    process.env.DATABASE_URL = SITE;
    process.env.POSTGRES_URL = BOT;

    void sqlFor(SITE_DB_ENV)`SELECT 1`.catch(() => undefined);
    void sqlFor(BOT_DB_ENV)`SELECT 1`.catch(() => undefined);

    expect(openPoolCount()).toBe(2);
  });

  it('duas listas de env apontando para a MESMA URL compartilham um pool só', () => {
    // É o caso normal hoje: site e auth vão para davimf_dev.
    process.env.DATABASE_URL = SITE;
    process.env.NETLIFY_DATABASE_URL = SITE;

    void sqlFor(SITE_DB_ENV)`SELECT 1`.catch(() => undefined);
    void sqlFor(AUTH_DB_ENV)`SELECT 1`.catch(() => undefined);

    expect(openPoolCount()).toBe(1);
  });

  it('URLs distintas para site e auth mantêm pools distintos', () => {
    // Cenário de segurança: se as duas variáveis apontarem para bancos
    // diferentes, cada handler continua indo para o banco em que os dados dele
    // estão — unificar faria tabela "sumir".
    process.env.DATABASE_URL = SITE;
    process.env.NETLIFY_DATABASE_URL = 'postgres://u:p@postgres:5432/outro_banco';

    void sqlFor(SITE_DB_ENV)`SELECT 1`.catch(() => undefined);
    void sqlFor(AUTH_DB_ENV)`SELECT 1`.catch(() => undefined);

    expect(openPoolCount()).toBe(2);
  });
});

describe('compatibilidade com o driver antigo', () => {
  it('converte undefined em NULL, como o driver da Neon fazia', () => {
    // Sem isto o postgres.js lança UNDEFINED_VALUE, e handlers que interpolam
    // campos crus do corpo (accounts.ts) passariam a quebrar em runtime.
    expect(poolOptions().transform).toEqual({ undefined: null });
  });

  it('usa pool limitado, com timeout de conexão e reciclagem', () => {
    const options = poolOptions();
    expect(options.max).toBe(10);
    expect(options.connect_timeout).toBeGreaterThan(0);
    expect(options.idle_timeout).toBeGreaterThan(0);
    expect(options.max_lifetime).toBeGreaterThan(0);
  });

  it('prepared statements ligados por padrão, desligáveis atrás de PgBouncer', () => {
    expect(poolOptions().prepare).toBe(true);
    process.env.PGBOUNCER = 'true';
    expect(poolOptions().prepare).toBe(false);
    delete process.env.PGBOUNCER;
  });

  it('tamanho do pool é configurável por ambiente', () => {
    process.env.DB_POOL_MAX = '4';
    expect(poolOptions().max).toBe(4);
    delete process.env.DB_POOL_MAX;
  });

  it('a template tag continua sendo uma função chamável com strings e valores', () => {
    process.env.DATABASE_URL = SITE;
    const sql = sqlFor(SITE_DB_ENV);
    expect(typeof sql).toBe('function');
    const pending = sql`SELECT ${1}`;
    expect(typeof pending.then).toBe('function');
    void pending.catch(() => undefined);
  });
});
