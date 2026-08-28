/**
 * Tentativas de acessar pedido inexistente ou de outro usuário.
 *
 * Não vão para `refund_requests`: uma rajada delas é enumeração de ids, que é
 * assunto de segurança, não atividade de reembolso. A resposta ao cliente
 * continua sendo 404 idêntico nos dois casos — o log é interno.
 */
export function logOrderAccessDenied(input: { userId: string; orderId: string }): void {
  console.warn(`[security] ORDER_ACCESS_DENIED user=${input.userId} order=${input.orderId}`);
}
