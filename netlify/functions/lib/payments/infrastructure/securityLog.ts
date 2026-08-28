/**
 * Tentativas de acessar pedido inexistente ou de outro usuário.
 *
 * Não vão para `refund_requests`: uma rajada delas é enumeração de ids, que é
 * assunto de segurança, não atividade de reembolso. A resposta ao cliente
 * continua sendo 404 idêntico nos dois casos — o log é interno.
 */

/**
 * Remove caracteres de controle (< 0x20 e 0x7F) para evitar injeção de log
 * e limita o comprimento a 120 caracteres.
 */
function sanitizeLogValue(value: string): string {
  return value
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove controle + DEL
    .slice(0, 120);
}

export function logOrderAccessDenied(input: { userId: string; orderId: string }): void {
  const safeUserId = sanitizeLogValue(input.userId);
  const safeOrderId = sanitizeLogValue(input.orderId);
  console.warn(`[security] ORDER_ACCESS_DENIED user=${safeUserId} order=${safeOrderId}`);
}
