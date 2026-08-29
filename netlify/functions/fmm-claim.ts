/**
 * Resgate da chave de licença de um pedido ANTIGO, consultado pelo app do FMM
 * (não pelo site) através de `?ref=`.
 *
 * O que restou aqui é só a LEITURA: encontra o pedido pela referência e devolve
 * a chave já emitida. A metade que verificava o pagamento no AbacatePay e
 * emitia a chave na hora foi removida junto com aquele provedor — não existem
 * checkouts novos por lá, então nenhum pedido volta a transitar de "sem chave"
 * para "pago". Um pedido sem chave agora é caso de emissão manual.
 *
 * Vendas atuais não passam por aqui: elas nascem em `orders` pelo módulo de
 * pagamentos e a licença é entregue por `PaymentService`.
 */

import { Context } from '@netlify/functions';
import { sql, jsonResponse, errorResponse } from './lib/fmm-license.js';

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') return errorResponse('Method Not Allowed', 405);

  const ref = new URL(req.url).searchParams.get('ref');
  if (!ref) return errorResponse('Missing ref', 400);

  const rows = await sql`
    SELECT plan, period, license_key
    FROM fmm_orders
    WHERE ref = ${ref}
    LIMIT 1
  ` as Array<{
    plan: string;
    period: string;
    license_key: string | null;
  }>;

  if (!rows.length) return errorResponse('Order not found', 404);

  const order = rows[0];

  if (order.license_key) {
    return jsonResponse({ key: order.license_key, plan: order.plan, period: order.period });
  }

  // Pedido legado sem chave emitida. Não há mais como verificar o pagamento
  // automaticamente; o cliente precisa falar com o suporte.
  return errorResponse(
    'Pedido antigo sem chave emitida. Fale com o suporte em contato@davimf.dev.',
    409,
  );
};
