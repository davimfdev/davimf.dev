/**
 * Variáveis que a Netlify injetava sozinha e que aqui precisam ser explícitas,
 * mais um aviso de arranque para configuração incompleta.
 */

type EnvGroup = { label: string; vars: string[] };

const EXPECTED: EnvGroup[] = [
  { label: 'Banco do site (todo, notas, encurtador, contas)', vars: ['DATABASE_URL'] },
  { label: 'Banco do site (auth JWT, expenses, transactions)', vars: ['NETLIFY_DATABASE_URL'] },
  { label: 'Banco de config do bot (dashboard)', vars: ['BOT_CONFIG_DATABASE_URL'] },
  { label: 'Banco de tickets', vars: ['TICKETS_NEON'] },
  { label: 'Discord OAuth', vars: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI'] },
  { label: 'Sessão do dashboard', vars: ['DASHBOARD_SESSION_SECRET', 'DASHBOARD_TOKEN_ENCRYPTION_KEY', 'BOT_SUPPORT_USER_IDS'] },
  { label: 'Auth JWT legado', vars: ['JWT_SECRET'] },
  { label: 'Licenças FMM', vars: ['FMM_APP_SECRET', 'FMM_ADMIN_SECRET'] },
  { label: 'Pagamentos AbacatePay', vars: ['ABACATEPAY_KEY'] },
  { label: 'Ingestão de tickets', vars: ['TICKET_INGEST_SECRET'] },
  { label: 'Cotações', vars: ['EXCHANGERATE_API_KEY'] },
  { label: 'URL pública do site', vars: ['URL'] },
];

/**
 * `process.env.URL` era preenchida automaticamente pela Netlify e ainda é lida
 * por abacate-checkout (completionUrl) e shorten (base do link curto). Fora da
 * Netlify ela precisa vir do ambiente; PUBLIC_SITE_URL é aceito como apelido
 * porque "URL" é um nome de variável fácil de colidir em alguns painéis.
 */
export function applyCompatibilityEnv(): void {
  if (!process.env.URL && process.env.PUBLIC_SITE_URL) {
    process.env.URL = process.env.PUBLIC_SITE_URL;
  }
}

/** Só avisa: um endpoint mal configurado deve falhar sozinho, não derrubar a API. */
export function warnMissingEnv(): string[] {
  const missing: string[] = [];
  for (const group of EXPECTED) {
    for (const name of group.vars) {
      if (!process.env[name]) missing.push(`${name} (${group.label})`);
    }
  }
  if (missing.length > 0) {
    console.warn(
      `[api] ${missing.length} variável(is) de ambiente ausente(s); os endpoints que dependem delas vão responder erro:\n  - ${missing.join('\n  - ')}`,
    );
  }
  return missing;
}
