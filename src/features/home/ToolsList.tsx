/**
 * Ferramentas como lista técnica, não como quatro cards iguais.
 *
 * Quatro linhas ocupam menos altura que quatro cards e leem mais rápido. A
 * separação é hairline; no hover a linha inteira acende e a seta desliza — o
 * alvo de clique é a linha, não um botão dentro dela.
 *
 * Um link "ver todas" aponta para /tools, que existe e é útil.
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { TOOLS } from './homeData';
import { Reveal } from './Reveal';
import { SectionHeading } from './SectionHeading';

export function ToolsList() {
  const { translations } = useLanguage();
  const t = translations.home.tools;

  return (
    <section className="py-section">
      <SectionHeading label={t.heading} id="tools" />

      <ul className="border-t border-line">
        {TOOLS.map((tool, index) => {
          const copy = t[tool.key];
          return (
            <li key={tool.key} className="border-b border-line">
              <Reveal delay={index * 50}>
                <Link
                  to={tool.href}
                  className="group flex items-baseline gap-4 sm:gap-8 py-5 px-2 -mx-2 hover:bg-surface-1 transition-colors duration-fast"
                >
                  <span className="text-eyebrow text-fg-muted tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-fg w-28 shrink-0">{copy.name}</span>
                  <span className="text-sm text-fg-muted flex-1">{copy.description}</span>
                  <ArrowRight
                    size={15}
                    className="text-fg-muted shrink-0 transition-transform duration-fast group-hover:translate-x-1 group-hover:text-accent"
                  />
                </Link>
              </Reveal>
            </li>
          );
        })}
        <li className="border-b border-line">
          <Reveal delay={TOOLS.length * 50}>
            <Link
              to="/tools"
              className="group flex items-baseline gap-4 sm:gap-8 py-5 px-2 -mx-2 hover:bg-surface-1 transition-colors duration-fast"
            >
              <span className="flex-1" />
              <span className="text-fg shrink-0">{t.seeAll}</span>
              <ArrowRight
                size={15}
                className="text-fg-muted shrink-0 transition-transform duration-fast group-hover:translate-x-1 group-hover:text-accent"
              />
            </Link>
          </Reveal>
        </li>
      </ul>
    </section>
  );
}
