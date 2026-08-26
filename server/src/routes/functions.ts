import type { NetlifyHandler } from '../utils/netlifyAdapter';
import type { WebHandler } from '../utils/webAdapter';

/**
 * Inventário das antigas Netlify Functions.
 *
 * `paths` reproduz TODAS as URLs que existiam na Netlify:
 *  - `/api/<nome-do-arquivo>` vinha do redirect `/api/* -> /.netlify/functions/:splat`;
 *  - caminhos extras vêm do `export const config = { path: ... }` de cada função,
 *    que na Netlify era uma rota *adicional* (a padrão continuava valendo).
 *
 * Os módulos são carregados sob demanda: várias funções abrem conexão com o Neon
 * no escopo do módulo, e o carregamento tardio mantém o isolamento que a
 * arquitetura serverless dava — uma env var ausente derruba só aquele endpoint.
 */
export type NetlifyStyleRoute = {
  name: string;
  paths: string[];
  load: () => Promise<{ handler: unknown }>;
};

export type WebStyleRoute = {
  name: string;
  paths: string[];
  load: () => Promise<{ default: unknown }>;
};

export const NETLIFY_STYLE_ROUTES: NetlifyStyleRoute[] = [
  { name: 'accounts', paths: ['/api/accounts'], load: () => import('../../../netlify/functions/accounts') },
  { name: 'bot-config-access', paths: ['/api/bot-config-access'], load: () => import('../../../netlify/functions/bot-config-access') },
  { name: 'bot-config-collection', paths: ['/api/bot-config-collection'], load: () => import('../../../netlify/functions/bot-config-collection') },
  { name: 'bot-config-get', paths: ['/api/bot-config-get'], load: () => import('../../../netlify/functions/bot-config-get') },
  { name: 'bot-config-patch', paths: ['/api/bot-config-patch'], load: () => import('../../../netlify/functions/bot-config-patch') },
  { name: 'bot-guilds', paths: ['/api/bot-guilds'], load: () => import('../../../netlify/functions/bot-guilds') },
  { name: 'bot-guilds-list', paths: ['/api/bot-guilds-list'], load: () => import('../../../netlify/functions/bot-guilds-list') },
  { name: 'create-short-url', paths: ['/api/create-short-url'], load: () => import('../../../netlify/functions/create-short-url') },
  { name: 'dashboard-login', paths: ['/api/dashboard-login'], load: () => import('../../../netlify/functions/dashboard-login') },
  { name: 'dashboard-logout', paths: ['/api/dashboard-logout'], load: () => import('../../../netlify/functions/dashboard-logout') },
  { name: 'dashboard-session', paths: ['/api/dashboard-session'], load: () => import('../../../netlify/functions/dashboard-session') },
  { name: 'getAccounts', paths: ['/api/getAccounts'], load: () => import('../../../netlify/functions/getAccounts') },
  { name: 'getTransactions', paths: ['/api/getTransactions'], load: () => import('../../../netlify/functions/getTransactions') },
  { name: 'getUserUrls', paths: ['/api/getUserUrls'], load: () => import('../../../netlify/functions/getUserUrls') },
  { name: 'guild-config-get', paths: ['/api/guild-config-get'], load: () => import('../../../netlify/functions/guild-config-get') },
  { name: 'guild-config-set', paths: ['/api/guild-config-set'], load: () => import('../../../netlify/functions/guild-config-set') },
  { name: 'notes', paths: ['/api/notes'], load: () => import('../../../netlify/functions/notes') },
  { name: 'shorten', paths: ['/api/shorten'], load: () => import('../../../netlify/functions/shorten') },
  { name: 'tasks', paths: ['/api/tasks'], load: () => import('../../../netlify/functions/tasks') },
];

export const WEB_STYLE_ROUTES: WebStyleRoute[] = [
  { name: 'abacate-checkout', paths: ['/api/abacate-checkout'], load: () => import('../../../netlify/functions/abacate-checkout') },
  { name: 'callback', paths: ['/api/callback'], load: () => import('../../../netlify/functions/callback') },
  // `config.path` era "/api/deleteurl"; "/api/delete-url" é o caminho que o
  // UrlShortener.tsx sempre chamou (e que estava 404 na Netlify por causa do hífen).
  { name: 'deleteUrl', paths: ['/api/deleteUrl', '/api/deleteurl', '/api/delete-url'], load: () => import('../../../netlify/functions/deleteUrl') },
  { name: 'exchange-rates', paths: ['/api/exchange-rates'], load: () => import('../../../netlify/functions/exchange-rates') },
  { name: 'expenses', paths: ['/api/expenses'], load: () => import('../../../netlify/functions/expenses') },
  { name: 'fmm-activate', paths: ['/api/fmm-activate'], load: () => import('../../../netlify/functions/fmm-activate') },
  { name: 'fmm-admin-generate', paths: ['/api/fmm-admin-generate'], load: () => import('../../../netlify/functions/fmm-admin-generate') },
  { name: 'fmm-admin-keys', paths: ['/api/fmm-admin-keys'], load: () => import('../../../netlify/functions/fmm-admin-keys') },
  { name: 'fmm-claim', paths: ['/api/fmm-claim'], load: () => import('../../../netlify/functions/fmm-claim') },
  { name: 'fmm-generate', paths: ['/api/fmm-generate'], load: () => import('../../../netlify/functions/fmm-generate') },
  { name: 'fmm-keys', paths: ['/api/fmm-keys'], load: () => import('../../../netlify/functions/fmm-keys') },
  { name: 'fmm-my-keys', paths: ['/api/fmm-my-keys'], load: () => import('../../../netlify/functions/fmm-my-keys') },
  { name: 'fmm-revoke', paths: ['/api/fmm-revoke'], load: () => import('../../../netlify/functions/fmm-revoke') },
  { name: 'fmm-validate', paths: ['/api/fmm-validate'], load: () => import('../../../netlify/functions/fmm-validate') },
  { name: 'get-url', paths: ['/api/get-url'], load: () => import('../../../netlify/functions/get-url') },
  { name: 'getmyurls', paths: ['/api/getmyurls'], load: () => import('../../../netlify/functions/getmyurls') },
  { name: 'logout', paths: ['/api/logout'], load: () => import('../../../netlify/functions/logout') },
  { name: 'refresh', paths: ['/api/refresh'], load: () => import('../../../netlify/functions/refresh') },
  { name: 'register', paths: ['/api/register'], load: () => import('../../../netlify/functions/register') },
  { name: 'request-password-reset', paths: ['/api/request-password-reset'], load: () => import('../../../netlify/functions/request-password-reset') },
  { name: 'reset-password', paths: ['/api/reset-password'], load: () => import('../../../netlify/functions/reset-password') },
  { name: 'ticket-get', paths: ['/api/ticket-get', '/api/ticket'], load: () => import('../../../netlify/functions/ticket-get') },
  { name: 'ticket-store', paths: ['/api/ticket-store'], load: () => import('../../../netlify/functions/ticket-store') },
  { name: 'transactions', paths: ['/api/transactions'], load: () => import('../../../netlify/functions/transactions') },
  { name: 'transfer', paths: ['/api/transfer'], load: () => import('../../../netlify/functions/transfer') },
];

export function asNetlifyHandler(module: { handler: unknown }, name: string): NetlifyHandler {
  const handler = module.handler;
  if (typeof handler !== 'function') throw new Error(`Function "${name}" não exporta "handler"`);
  return handler as NetlifyHandler;
}

export function asWebHandler(module: { default: unknown }, name: string): WebHandler {
  const handler = module.default;
  if (typeof handler !== 'function') throw new Error(`Function "${name}" não exporta "default"`);
  return handler as WebHandler;
}

/** Todas as URLs expostas — usado pelo endpoint de diagnóstico e pelos testes. */
export function allRoutePaths(): string[] {
  return [...NETLIFY_STYLE_ROUTES, ...WEB_STYLE_ROUTES].flatMap((route) => route.paths).sort();
}
