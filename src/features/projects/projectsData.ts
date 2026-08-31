/**
 * Os projetos e suas tecnologias.
 *
 * Fonte única para duas telas: o `/about` mostra as três primeiras tags de cada
 * projeto, o `/portfolio` mostra todas e filtra por elas. Por isso `tech` está
 * ordenado da tecnologia mais definidora para a menos — reordenar por outro
 * motivo muda o que aparece no About.
 *
 * Nada aqui é suposição: FMM, BaseBot e o VPS vieram do dono; davimf.dev foi
 * lido do próprio package.json; boasvindas.online veio do STACK.md daquele
 * repositório.
 */

export type ProjectKind = 'product' | 'site' | 'tools';

export type Project = {
  key: string;
  kind: ProjectKind;
  tech: readonly string[];
  /** Interno começa com "/", externo é URL completa, null quando não há destino. */
  href: string | null;
};

export const PROJECTS: readonly Project[] = [
  { key: 'fmm', kind: 'product', tech: ['Go', 'Wails', 'PostgreSQL'], href: '/fmm' },
  { key: 'basebot', kind: 'product', tech: ['Java', 'JDA', 'SQLite', 'PostgreSQL'], href: '/products' },
  { key: 'davimfdev', kind: 'site', tech: ['TypeScript', 'React', 'Vite', 'Tailwind', 'Express', 'PostgreSQL', 'Docker', 'Nginx'], href: null },
  { key: 'boasvindas', kind: 'site', tech: ['Next.js', 'TypeScript', 'Tailwind', 'Drizzle', 'PostgreSQL'], href: 'https://boasvindas.online' },
  { key: 'tools', kind: 'tools', tech: ['TypeScript', 'React'], href: '/tools' },
] as const;

/** Todas as tecnologias distintas, ordenadas — o /portfolio filtra por esta lista. */
export const ALL_TECH = [...new Set(PROJECTS.flatMap((project) => project.tech))].sort();
