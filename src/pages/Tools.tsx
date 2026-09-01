/**
 * Índice das ferramentas.
 *
 * Substitui o dropdown "Funcionalidades" da navbar antiga, que era uma lista
 * solta sem hierarquia. Aqui as ferramentas são linhas numeradas com hairline
 * entre elas — mesma linguagem da seção da Home, em escala de página.
 *
 * Sem cards: seis caixas iguais leriam como um catálogo de SaaS, e o revamp
 * trata "evitar card em tudo" como requisito.
 */

import { Link } from 'react-router-dom';
import {
  ArrowRight, StickyNote, Link2, Wallet, KeyRound, ListChecks, Dices,
  type LucideIcon,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Eyebrow } from '../components/ui';
import { TOOLS_ALL } from '../features/home/homeData';

// Um ícone por ferramenta — mapeado aqui, não em homeData.ts, que fica puro
// dado (sem componentes React nem dependência de lucide).
const ICONS: Record<string, LucideIcon> = {
  notes: StickyNote,
  url: Link2,
  finance: Wallet,
  password: KeyRound,
  todo: ListChecks,
  roulette: Dices,
};

const Tools = () => {
  const { translations } = useLanguage();
  const t = translations.home;

  return (
    <div className="max-w-content mx-auto py-10">
      <div className="flex items-center gap-4 mb-8 md:mb-12">
        <Eyebrow>{t.tools.heading}</Eyebrow>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <Eyebrow>{String(TOOLS_ALL.length).padStart(2, '0')}</Eyebrow>
      </div>

      <h1 className="text-display-2 font-display font-bold text-fg text-balance">
        {t.toolsPage.title}
      </h1>
      <p className="mt-6 text-fg-soft max-w-prose leading-relaxed">{t.toolsPage.intro}</p>

      <ul className="mt-11 md:mt-14 border-t border-line">
        {TOOLS_ALL.map((tool, index) => {
          const copy = t.tools[tool.key];
          const Icon = ICONS[tool.key];
          return (
            <li key={tool.key} className="border-b border-line">
              <Link
                to={tool.href}
                className="group relative flex py-5 px-2 -mx-2 hover:bg-surface-1 transition-colors duration-fast"
              >
                {/* Barra de 2px na borda esquerda — sinaliza hover sem virar
                    card: nenhuma borda ao redor da linha, só esse traço. */}
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent scale-y-0 origin-center transition-transform duration-fast group-hover:scale-y-100"
                />
                <div className="flex items-center gap-4 sm:gap-8 w-full transition-transform duration-fast group-hover:translate-x-1">
                  <span className="text-display-4 tabular-nums text-fg-muted shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <Icon
                    size={18}
                    className="text-fg-muted shrink-0 transition-colors duration-fast group-hover:text-accent"
                  />
                  <span className="text-fg w-32 shrink-0">{copy.name}</span>
                  <span className="text-sm text-fg-muted flex-1">{copy.description}</span>
                  <ArrowRight
                    size={15}
                    className="text-fg-muted shrink-0 transition-colors duration-fast group-hover:text-accent"
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Tools;
