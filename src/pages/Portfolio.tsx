/**
 * Índice completo e filtrável de projetos.
 *
 * Diferente do /about (que resume as três tecnologias mais definidoras de
 * cada projeto), esta página é o catálogo técnico completo: toda tag de
 * cada projeto, e um filtro por tecnologia sobre `ALL_TECH`.
 *
 * Sem imagens de propósito — os únicos screenshots reais do produto são os
 * do FMM, já usados na Home; inventar arte para os outros projetos não é
 * opção. É uma lista técnica, não uma grade de cards.
 *
 * Filtro é OR, não AND: com cinco projetos, AND esvaziaria a lista no
 * segundo clique.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Eyebrow, Badge } from '../components/ui';
import { PROJECTS, ALL_TECH } from '../features/projects/projectsData';

const Portfolio = () => {
  const { translations } = useLanguage();
  const t = translations.home;
  const p = t.projects;
  const port = t.portfolio;

  const [selected, setSelected] = useState<readonly string[]>([]);

  const toggleTech = (tech: string) => {
    setSelected((current) =>
      current.includes(tech) ? current.filter((item) => item !== tech) : [...current, tech]
    );
  };

  const clearSelection = () => setSelected([]);

  const visibleProjects =
    selected.length === 0
      ? PROJECTS
      : PROJECTS.filter((project) => project.tech.some((tech) => selected.includes(tech)));

  const countLabel = visibleProjects.length === 1 ? port.countOne : port.count;

  return (
    <div className="max-w-content mx-auto py-10 animate-fade-in">
      <div className="flex items-center gap-4 mb-12">
        <Eyebrow>{port.title}</Eyebrow>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>

      <p className="text-display-3 font-display text-fg max-w-prose text-balance leading-tight">
        {port.intro}
      </p>

      <section className="mt-16">
        <div className="flex items-center gap-4 mb-4">
          <Eyebrow>{port.filterLabel}</Eyebrow>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-eyebrow font-semibold uppercase text-fg-muted hover:text-accent transition-colors duration-fast"
            >
              {port.clear}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_TECH.map((tech) => {
            const active = selected.includes(tech);
            return (
              <button
                key={tech}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTech(tech)}
                className={[
                  'px-2.5 py-1 rounded-chip border text-sm transition-colors duration-fast',
                  active
                    ? 'bg-accent text-bg border-accent'
                    : 'bg-surface-1 text-fg-soft border-line hover:border-line-strong hover:text-fg',
                ].join(' ')}
              >
                {tech}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm text-fg-muted">
          {visibleProjects.length} {countLabel}
        </p>

        <ul className="mt-8 divide-y divide-line">
          {visibleProjects.map((project) => {
            const copy = p[project.key as keyof typeof p] as { name: string; description: string };
            return (
              <li key={project.key} className="py-6 first:pt-0">
                <h3 className="text-fg font-medium text-lg">
                  {project.href === null ? (
                    copy.name
                  ) : project.href.startsWith('/') ? (
                    <Link to={project.href} className="hover:text-accent transition-colors duration-fast">
                      {copy.name}
                    </Link>
                  ) : (
                    <a
                      href={project.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-accent transition-colors duration-fast"
                    >
                      {copy.name}
                    </a>
                  )}
                </h3>
                <p className="mt-1 text-fg-soft">{copy.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.tech.map((tech) => (
                    <Badge key={tech} tone="neutral">{tech}</Badge>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default Portfolio;
