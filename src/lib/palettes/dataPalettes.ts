/**
 * Cores que são DADO, não estilo.
 *
 * Uma paleta categórica precisa ser mutuamente distinguível, não harmônica com
 * a marca; um seletor de destaque é a oferta ao usuário. Nenhuma das duas pode
 * virar token, e nenhuma pode quebrar a verificação anti-hardcode.
 *
 * O prefixo `DATA_PALETTE_` é o contrato: a regra `local/no-raw-color` isenta
 * literais de cor apenas dentro de declarações com este nome, e em nenhum
 * outro lugar — nem no restante destes arquivos, nem no restante dos arquivos
 * que as consomem. Ver spec §6.3.
 */

/** 12 cores categóricas do gráfico de gastos, escolhidas por distinguibilidade. */
export const DATA_PALETTE_CATEGORY = [
  '#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#8b5cf6', '#f43f5e', '#14b8a6', '#f97316',
] as const;

/** 8 cores oferecidas ao usuário para destacar uma nota. */
export const DATA_PALETTE_NOTE_HIGHLIGHT = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ec4899', '#ef4444', '#f97316', '#6b7280',
] as const;

/**
 * Cores de marca do Discord, exigidas pelas diretrizes deles no botão de login.
 * Não são escolha estética deste site e por isso não viram token.
 *
 * Só a marca: o cromo do dropdown que imita o visual do Discord migra para
 * `fg-soft` e `line` como qualquer outro cromo.
 */
export const DATA_PALETTE_DISCORD = {
  blurple: '#5865F2',
  danger: '#da373c',
} as const;
