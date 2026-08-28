/**
 * Variáveis que a Netlify injetava sozinha e que aqui precisam ser explícitas,
 * mais o carregamento do .env e o aviso de arranque para configuração
 * incompleta.
 *
 * Nenhum valor de ambiente é embutido no código: tudo continua vindo de
 * `process.env`. O que este módulo faz é (a) garantir que o `.env` seja lido
 * nos modos de execução que não liam, e (b) reconhecer os apelidos que as
 * plataformas usam para a URL pública.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DatabaseTarget } from '../../../netlify/functions/lib/db';

type EnvGroup = {
  label: string;
  vars: string[];
  /** Nomes herdados que satisfazem o grupo igualmente. */
  alternatives?: string[];
  /** Ausência é aceitável: o código tem padrão ou a feature está desligada. */
  optional?: boolean;
};

const REQUIRED: EnvGroup[] = [
  // Conexões PostgreSQL por TCP (postgres.js). `NETLIFY_DATABASE_URL`,
  // `BOT_CONFIG_DATABASE_URL` e `TICKETS_NEON` são os nomes herdados da Netlify
  // e continuam aceitos como alternativa — ver netlify/functions/lib/db.ts.
  { label: 'Banco do site davimf_dev', vars: ['DATABASE_URL'], alternatives: ['NETLIFY_DATABASE_URL'] },
  { label: 'Banco de config do bot bot_configs', vars: ['POSTGRES_URL'], alternatives: ['BOT_CONFIG_DATABASE_URL'] },
  { label: 'Banco de tickets', vars: ['TICKETS_NEON'], alternatives: ['TICKETS_DATABASE_URL'] },
  { label: 'Discord OAuth', vars: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI'] },
  { label: 'Sessão do dashboard', vars: ['DASHBOARD_SESSION_SECRET', 'DASHBOARD_TOKEN_ENCRYPTION_KEY', 'BOT_SUPPORT_USER_IDS'] },
  { label: 'Auth JWT legado', vars: ['JWT_SECRET'] },
  { label: 'Licenças FMM', vars: ['FMM_APP_SECRET', 'FMM_ADMIN_SECRET'] },
  {
    label: 'Pagamentos (Mercado Pago)',
    vars: ['MERCADOPAGO_PUBLIC_KEY', 'MERCADOPAGO_ACCESS_TOKEN'],
  },
  {
    label: 'Webhooks Mercado Pago (mesma URL em teste e produção)',
    vars: ['MERCADOPAGO_WEBHOOK_SECRET_TEST', 'MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION'],
  },
  { label: 'E-mails transacionais (Resend)', vars: ['RESEND_API_KEY'] },
  { label: 'Ingestão de tickets', vars: ['TICKET_INGEST_SECRET'] },
  { label: 'Cotações', vars: ['EXCHANGERATE_API_KEY'] },
  { label: 'URL pública do site', vars: ['URL'] },
];

const OPTIONAL: EnvGroup[] = [
  // Fluxo antigo de checkout, mantido só enquanto houver pedido em aberto.
  { label: 'Pagamentos AbacatePay (legado, desativável)', vars: ['ABACATEPAY_KEY'], optional: true },
  // Têm padrão no código (mercadopago / sandbox).
  { label: 'Pagamentos — ajustes com padrão', vars: ['PAYMENTS_PROVIDER', 'PAYMENTS_ENV'], optional: true },
  {
    label: 'Pagamentos — perfil de cobrança criptografado',
    vars: ['PAYMENTS_PAYER_ENCRYPTION_KEY'],
    optional: true,
  },
];

// --------------------------------------------------------------- .env ------

/**
 * Sobe a partir de um diretório procurando um `.env`.
 *
 * `npm run dev` roda com CWD em `server/` e o arquivo mora na raiz do repo;
 * `npm start` e o container rodam com outro CWD. Procurar subindo cobre os
 * dois sem depender de contagem frágil de `../`.
 */
function findEnvFile(startDir: string, levels = 4): string | null {
  let current = startDir;
  for (let depth = 0; depth <= levels; depth += 1) {
    const candidate = resolve(current, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/**
 * Carrega o `.env` quando ele existe, em QUALQUER modo de execução.
 *
 * Antes, só `npm run dev` lia o arquivo (`tsx --env-file-if-exists`);
 * `npm start` e o `CMD` do Docker não liam nada, então uma variável definida
 * apenas no `.env` sumia fora do dev — era esse o caso de `URL`.
 *
 * `process.loadEnvFile` NÃO sobrescreve o que já está no ambiente, então a env
 * real da plataforma (Coolify) continua tendo precedência sobre o arquivo.
 * Na imagem Docker o `.env` é excluído de propósito: aqui vira no-op.
 */
export function loadEnvFileIfPresent(): string | null {
  const explicit = process.env.ENV_FILE;
  const path = explicit
    ? (existsSync(resolve(explicit)) ? resolve(explicit) : null)
    : (findEnvFile(process.cwd()) ?? findEnvFile(__dirname));

  if (!path) {
    if (explicit) console.warn(`[api] ENV_FILE aponta para um arquivo inexistente: ${explicit}`);
    return null;
  }

  if (typeof process.loadEnvFile !== 'function') {
    console.warn(`[api] Node ${process.version} não suporta process.loadEnvFile; ${path} ignorado. Use "node --env-file" ou defina as variáveis no ambiente.`);
    return null;
  }

  try {
    process.loadEnvFile(path);
    return path;
  } catch (error) {
    console.warn(`[api] falha ao ler ${path}: ${(error as Error).message}`);
    return null;
  }
}

// ----------------------------------------------------------- URL pública ---

/**
 * Apelidos aceitos para a URL pública, em ordem de precedência.
 *
 * `URL` é o nome canônico (é o que os handlers leem). Os demais existem porque
 * painéis de deploy costumam expor o domínio com outro nome — o Coolify, por
 * exemplo, gera `SERVICE_FQDN_*` e `COOLIFY_FQDN` como host puro, sem esquema.
 */
const SITE_URL_ALIASES = [
  'URL',
  'PUBLIC_SITE_URL',
  'SITE_URL',
  'APP_URL',
  'COOLIFY_URL',
  'COOLIFY_FQDN',
] as const;

/**
 * Normaliza para uma base sem barra final e com esquema.
 *
 * Os consumidores concatenam direto (`${URL}/r/${code}`,
 * `${URL}/fmm-activated?...`), então "https://davimf.dev/" ou "davimf.dev"
 * gerariam link quebrado se passassem crus.
 */
export function normalizeSiteUrl(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname) return null;
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

/** Primeiro apelido preenchido, incluindo os `SERVICE_FQDN_*` do Coolify. */
function rawSiteUrl(): string | undefined {
  for (const name of SITE_URL_ALIASES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  const serviceFqdn = Object.keys(process.env)
    .filter((key) => key.startsWith('SERVICE_FQDN_'))
    .sort()
    .map((key) => process.env[key]?.trim())
    .find(Boolean);
  return serviceFqdn ?? undefined;
}

/**
 * Resolve a URL pública e grava o resultado normalizado em `process.env.URL`,
 * que é o nome que abacate-checkout, shorten e o módulo de pagamentos leem.
 *
 * O valor NUNCA é embutido no código: sai sempre do ambiente.
 */
export function applyCompatibilityEnv(): string | null {
  const resolved = normalizeSiteUrl(rawSiteUrl());
  if (resolved) {
    process.env.URL = resolved;
    return resolved;
  }
  // Valor presente mas inutilizável: melhor limpar do que propagar link quebrado.
  if (process.env.URL !== undefined) delete process.env.URL;
  return null;
}

// -------------------------------------------------------------- diagnóstico -

function missingFrom(groups: EnvGroup[]): string[] {
  const missing: string[] = [];
  for (const group of groups) {
    // Um nome herdado preenchido satisfaz o grupo inteiro: quem ainda usa
    // NETLIFY_DATABASE_URL não é avisado de que "falta" DATABASE_URL.
    if (group.alternatives?.some((name) => process.env[name])) continue;
    for (const name of group.vars) {
      if (!process.env[name]) {
        const also = group.alternatives?.length ? ` — ou ${group.alternatives.join('/')}` : '';
        missing.push(`${name} (${group.label}${also})`);
      }
    }
  }
  return missing;
}

/** Só avisa: um endpoint mal configurado deve falhar sozinho, não derrubar a API. */
export function warnMissingEnv(): string[] {
  const missing = missingFrom(REQUIRED);

  if (missing.length > 0) {
    console.warn(
      `[api] ${missing.length} variável(is) de ambiente ausente(s); os endpoints que dependem delas vão responder erro:\n  - ${missing.join('\n  - ')}`,
    );
  }

  if (!process.env.URL) {
    console.warn(
      `[api] URL pública não definida. Defina URL (ex.: URL=https://davimf.dev) no ambiente ou no .env.\n` +
        `      Também são aceitos, nesta ordem: ${SITE_URL_ALIASES.slice(1).join(', ')}, SERVICE_FQDN_*.`,
    );
  }

  const optionalMissing = missingFrom(OPTIONAL);
  if (optionalMissing.length > 0) {
    console.info(`[api] opcionais não definidas (sem impacto no arranque): ${optionalMissing.join(', ')}`);
  }

  return missing;
}

/** Uma linha no boot dizendo de onde a configuração veio. */
export function logEnvSummary(envFile: string | null, siteUrl: string | null): void {
  console.log(
    `[api] configuração: ${envFile ? `.env em ${envFile}` : 'somente variáveis do ambiente'}; ` +
      `URL pública = ${siteUrl ?? '(ausente)'}`,
  );
}

/**
 * Para onde cada banco aponta, sem credencial.
 *
 * "relation ... does not exist" quase sempre é migração aplicada num banco e
 * aplicação lendo outro; com isto no arranque o diagnóstico é imediato.
 */
export function logDatabaseTargets(targets: DatabaseTarget[]): void {
  for (const target of targets) {
    const destino = target.envVar
      ? `${target.envVar} → ${target.host ?? '?'}/${target.database ?? '?'}`
      : '(nenhuma variável definida)';
    console.log(`[api] banco ${target.label.padEnd(22)} ${destino}`);
  }
}
