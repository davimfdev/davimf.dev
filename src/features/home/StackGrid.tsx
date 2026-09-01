/**
 * Stack como sistema, não como nuvem de logos.
 *
 * Quatro colunas rotuladas com divisores de 1px. Vive no /about, não na Home:
 * a Home é landing e fala do QUE foi construído; aqui é o COM O QUÊ.
 */

import { useLanguage } from '../../context/LanguageContext';
import { STACK_GROUPS } from './homeData';
import { Eyebrow } from '../../components/ui';

export function StackGrid() {
  const { translations } = useLanguage();
  const t = translations.home.stack;

  return (
    <section className="mt-12 md:mt-16">
      <div className="flex items-center gap-4 mb-8">
        <Eyebrow>{t.heading}</Eyebrow>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 md:divide-x md:divide-line">
        {STACK_GROUPS.map((group, index) => (
          <div key={group.key} className={index === 0 ? 'md:pr-6' : 'md:px-6'}>
            <Eyebrow>{t[group.key]}</Eyebrow>
            <ul className="mt-4 space-y-1.5">
              {group.items.map((item) => (
                <li key={item} className="text-sm text-fg-soft">{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
