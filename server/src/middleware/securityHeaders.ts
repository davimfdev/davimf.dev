import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express';

/**
 * Cabeçalhos de segurança das respostas da API.
 *
 * O frontend recebe os dele do nginx que serve o build (ver `nginx.conf`); as
 * rotas `/api/*` não passam por lá — o Nginx Proxy Manager manda direto para
 * este container —, então quem responde por elas é este middleware.
 *
 * Toda resposta daqui é JSON ou redirect: nenhum handler devolve `text/html`.
 * Por isso a CSP pode ser a mais fechada que existe (`default-src 'none'`):
 * não há nada para carregar. Ela só importa se um dia alguém conseguir fazer
 * o navegador RENDERIZAR uma resposta da API — e é exatamente aí que
 * `nosniff` + CSP fechada + `frame-ancestors 'none'` derrubam o ataque.
 *
 * `Cache-Control: no-store` vale para respostas autenticadas (sessão do
 * dashboard, dados de pagamento) que não podem ficar em cache de proxy.
 */
export function securityHeadersMiddleware() {
  return (_req: ExpressRequest, res: ExpressResponse, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
}
