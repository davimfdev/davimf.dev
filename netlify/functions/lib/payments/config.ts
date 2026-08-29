/**
 * Configuração do módulo de pagamentos.
 *
 * Nada de segredo aqui — só leitura de env e as constantes públicas do site.
 */

/**
 * Download OFICIAL do FMM, o MESMO link que já existe no site
 * (src/pages/FmmPlans.tsx e src/pages/FmmActivated.tsx). Não inventar outro:
 * o cliente compra a CHAVE, o instalador é gratuito.
 */
export const FMM_DOWNLOAD_URL =
  process.env.FMM_DOWNLOAD_URL ??
  'https://github.com/davimfdev/FMM-Releases/releases/latest/download/FMM.exe';

/**
 * Base pública do site. Vem SEMPRE do ambiente — o domínio não é embutido aqui.
 *
 * `server/src/utils/env.ts` resolve os apelidos da plataforma e normaliza o
 * valor em `process.env.URL` no arranque; `PUBLIC_SITE_URL` fica como leitura
 * direta para quando um handler roda fora do servidor (testes, scripts). O
 * fallback de localhost é o mesmo já usado por shorten.ts.
 */
export function siteUrl(): string {
  const configured = process.env.URL ?? process.env.PUBLIC_SITE_URL;
  return (configured?.trim() || 'http://localhost:8888').replace(/\/+$/, '');
}

export function myKeysUrl(): string {
  return `${siteUrl()}/my-keys`;
}

export function orderUrl(orderId: string): string {
  return `${siteUrl()}/fmm-activated?order=${encodeURIComponent(orderId)}`;
}

/** Public key do Mercado Pago — é pública por definição, vai para o frontend. */
export function mercadoPagoPublicKey(): string | null {
  return process.env.MERCADOPAGO_PUBLIC_KEY ?? null;
}
