/**
 * `String(valor)` pode lançar — objeto sem protótipo (`Object.create(null)`),
 * `Symbol.toPrimitive` que lança, ou um acessor próprio que lança ao ser lido.
 * Compartilhado porque mais de um ponto do módulo embrulha um erro de origem
 * desconhecida (do provider, do nosso próprio código, ou de uma dependência
 * mal ligada) depois que dinheiro já pode ter se movido, e nesses pontos a
 * coerção NUNCA pode ela mesma lançar.
 */
export function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return 'erro não representável';
  }
}
