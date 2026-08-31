/**
 * Sinais concretos do que foi construído.
 *
 * Substitui os três cards de "Código Limpo / UI-UX Moderno / Responsivo", que
 * diziam o que se espera de qualquer software.
 *
 * Deliberadamente diferente da Stack: aqui é O QUE foi construído, lá é COM O
 * QUÊ. Sem essa distinção as duas seções viram a mesma lista duas vezes.
 *
 * Sem contêiner e sem borda: a régua superior faz a divisão que uma caixa
 * faria, sem fechar o conteúdo.
 */

import { useLanguage } from '../../context/LanguageContext';
import { Eyebrow } from '../../components/ui';
import { Reveal } from './Reveal';

export function EvidenceBand() {
  const { translations } = useLanguage();
  const rows = translations.home.evidence;

  return (
    <section className="py-section">
      <span className="block h-px w-full bg-line mb-8" aria-hidden="true" />
      <dl className="space-y-5">
        {[rows.payments, rows.licensing, rows.infra].map((row, index) => (
          <Reveal key={row.label} delay={index * 60}>
            <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-1 sm:gap-6">
              <dt><Eyebrow>{row.label}</Eyebrow></dt>
              <dd className="text-fg-soft">{row.value}</dd>
            </div>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}
