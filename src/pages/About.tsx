/**
 * Página dedicada de Sobre.
 *
 * É sobre o TRABALHO, não sobre a pessoa: nada de trajetória, datas ou cargo.
 * Todo conteúdo aqui ou é verificável no repositório ou foi dito pelo dono.
 *
 * A Home tem um teaser de três linhas que aponta para cá. As duas páginas não
 * podem repetir texto — foi exatamente esse o defeito que originou esta versão.
 *
 * Os projetos vêm de `projectsData.ts`, fonte compartilhada com o `/portfolio`.
 * Aqui mostramos só as três primeiras tags de cada um (resumo); o `/portfolio`
 * é o índice completo e filtrável — sem filtro aqui de propósito.
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Eyebrow, Badge } from '../components/ui';
import { StackGrid } from '../features/home/StackGrid';
import { PROJECTS, type ProjectKind } from '../features/projects/projectsData';

const KIND_ORDER: readonly ProjectKind[] = ['product', 'site', 'tools'];

const About = () => {
  const { translations } = useLanguage();
  const t = translations.home;
  const p = t.projects;

  return (
    <div className="max-w-content mx-auto py-10">
      <div className="flex items-center gap-4 mb-12">
        <Eyebrow>{t.about.heading}</Eyebrow>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <Eyebrow>{t.systemId}</Eyebrow>
      </div>

      <p className="text-display-3 font-display text-fg max-w-prose text-balance leading-tight">
        {t.about.intro}
      </p>

      <section className="mt-16">
        <div className="flex items-center gap-4 mb-8">
          <Eyebrow>{t.about.buildHeading}</Eyebrow>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>

        <dl className="space-y-8">
          {KIND_ORDER.map((kind) => (
            <div key={kind}>
              <Eyebrow>{p.kinds[kind]}</Eyebrow>
              <div className="mt-4 space-y-5">
                {PROJECTS.filter((project) => project.kind === kind).map((project) => {
                  const copy = p[project.key as keyof typeof p] as { name: string; description: string };
                  return (
                    <div key={project.key} className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-1 sm:gap-6">
                      <dt className="text-fg font-medium">
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
                      </dt>
                      <dd className="text-fg-soft">
                        {copy.description}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {project.tech.slice(0, 3).map((tech) => (
                            <Badge key={tech} tone="neutral">{tech}</Badge>
                          ))}
                        </div>
                      </dd>
                    </div>
                  );
                })}

                {kind === 'product' && (
                  <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-1 sm:gap-6">
                    <dt><Eyebrow>{p.custom.label}</Eyebrow></dt>
                    <dd className="text-fg-soft">{p.custom.value}</dd>
                  </div>
                )}
              </div>
            </div>
          ))}
        </dl>

        <Link
          to="/portfolio"
          className="inline-flex items-center gap-2 mt-8 text-sm text-fg hover:text-accent transition-colors duration-fast group"
        >
          {translations.viewProject}
          <ArrowRight size={15} className="transition-transform duration-fast group-hover:translate-x-1" />
        </Link>
      </section>

      <StackGrid />

      <Link
        to="/contact"
        className="inline-flex items-center gap-2 mt-16 text-sm text-fg hover:text-accent transition-colors duration-fast group"
      >
        {t.contact.cta}
        <ArrowRight size={15} className="transition-transform duration-fast group-hover:translate-x-1" />
      </Link>
    </div>
  );
};

export default About;
