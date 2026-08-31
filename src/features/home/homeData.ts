/**
 * Dados estruturais da Home. Nada de texto visível aqui — texto vive em
 * `translations.home`, cuja tipagem obriga PT e EN.
 *
 * O grafo do hero representa o ecossistema REAL: os nós são os sistemas que
 * existem, não enfeite. Trocar um nome aqui é trocar um fato.
 */

/** Coordenadas em viewBox 0 0 320 260. O centro é o nó do próprio davimf. */
export const ECOSYSTEM_NODES = [
  { id: 'API-01', x: 160, y: 34, kind: 'satellite' },
  { id: 'POSTGRESQL', x: 34, y: 130, kind: 'satellite' },
  { id: 'DAVIMF', x: 160, y: 130, kind: 'core' },
  { id: 'BASEBOT', x: 286, y: 130, kind: 'satellite' },
  { id: 'FMM', x: 160, y: 226, kind: 'satellite' },
] as const;

/** Só os satélites ligam ao core: o grafo é uma estrela, não uma malha. */
export const ECOSYSTEM_EDGES = ECOSYSTEM_NODES
  .filter((node) => node.kind === 'satellite')
  .map((node) => ({ from: 'DAVIMF', to: node.id }));

/** Ordem de exibição = ordem da numeração 01..04 na lista. */
export const TOOLS = [
  { key: 'notes', href: '/notes' },
  { key: 'url', href: '/encurtador' },
  { key: 'finance', href: '/finances' },
  { key: 'password', href: '/password-generator' },
] as const;

/**
 * Catálogo completo, para a página `/tools`. A Home mostra só os quatro de
 * `TOOLS`: lá a seção é uma amostra, aqui é o índice.
 */
export const TOOLS_ALL = [
  { key: 'notes', href: '/notes' },
  { key: 'url', href: '/encurtador' },
  { key: 'finance', href: '/finances' },
  { key: 'password', href: '/password-generator' },
  { key: 'todo', href: '/todo' },
  { key: 'roulette', href: '/roulette' },
] as const;

export const STACK_GROUPS = [
  { key: 'runtime', items: ['Node.js', 'Java', 'TypeScript'] },
  { key: 'data', items: ['PostgreSQL', 'Redis'] },
  { key: 'infra', items: ['Docker', 'Linux', 'Nginx'] },
  { key: 'platforms', items: ['Discord', 'FiveM', 'Mercado Pago'] },
] as const;

/**
 * Capturas reais dos produtos.
 *
 * `scale` e `offset` recortam por CSS em vez de recortar o arquivo: não há PIL,
 * sharp nem ImageMagick no ambiente, e instalar seria dependência nova. Trocar
 * estes PNGs por WebP já recortados depois é drop-in — o markup não muda.
 */
export const WORK_IMAGES = {
  fmmPrimary: { src: '/work/fmm-mods.png', scale: 1.9, offsetX: -6, offsetY: -4 },
  fmmSecondary: { src: '/work/fmm-optimization.png', scale: 2.1, offsetX: -10, offsetY: -12 },
} as const;
