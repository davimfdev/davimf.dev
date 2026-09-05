/**
 * Ponto de entrada HTTP do módulo de pagamentos.
 *
 * Handler no estilo Web API, igual aos demais de netlify/functions/. Toda a
 * lógica vive em lib/payments/ - este arquivo só delega, o que mantém o módulo
 * extraível para um serviço separado sem tocar em Orders/Products.
 */

import { routePaymentsRequest } from './lib/payments/router.js';

export default async (req: Request): Promise<Response> => routePaymentsRequest(req);
