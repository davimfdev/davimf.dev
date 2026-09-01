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
 *
 * Os PNGs de origem são 1918×1030 (a janela cheia do app). Como o `<img>` é
 * posicionado por um único fator de escala uniforme, a janela visível dentro
 * da moldura tem SEMPRE a proporção da moldura (16/10) em pixels de origem —
 * só o tamanho dela muda com `scale`, e `offsetX`/`offsetY` só a movem. Os
 * valores abaixo enquadram uma região real do screenshot da janela cheia:
 * foram derivados calculando, para cada `scale`/`offset`, o retângulo em
 * pixels de origem que ele mapeia dentro da moldura 16/10 — não chutados.
 * `fmmPrimary` enquadra a grade de mods (rótulos ESTRADAS e GRÁFICOS, duas
 * fileiras completas). `fmmSecondary` enquadra CPU + GPU da tela de
 * Otimização — mostrar as quatro colunas (CPU/GPU/RAM/ANÁLISE GERAL) exigiria
 * reduzir a imagem a ponto de o texto ficar ilegível, já que a fileira é
 * larga e baixa demais para a proporção 16/10. Se os PNGs forem substituídos
 * por versões já recortadas, os três campos zeram: `scale: 1, offsetX: 0,
 * offsetY: 0`.
 */
export const WORK_IMAGES = {
  fmmPrimary: { src: '/work/fmm-mods.png', scale: 3.32, offsetX: -36.6, offsetY: -108.4 },
  fmmSecondary: { src: '/work/fmm-optimization.png', scale: 2.35, offsetX: -27.6, offsetY: -44.2 },
  basebotPrimary: { src: '/work/basebot-servers.png', scale: 1.6, offsetX: -4, offsetY: -3 },
  basebotSecondary: { src: '/work/basebot-config.png', scale: 1.8, offsetX: -8, offsetY: -8 },
} as const;

/**
 * As capturas do BaseBot dependem da sessão Discord e do banco do dono, então
 * são depositadas à mão (ver `public/work/README.md`). Enquanto não existirem,
 * a seção não é renderizada: ausente é melhor que com imagem falsa.
 */
export const HAS_BASEBOT_SHOTS = false;
