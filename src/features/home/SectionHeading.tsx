/**
 * Rótulo de seção: eyebrow à esquerda, régua ocupando o resto da largura.
 *
 * É o que substitui título dentro de card. A régua faz a divisão que a borda
 * de um contêiner faria, sem fechar o conteúdo numa caixa.
 */

import { Eyebrow } from '../../components/ui';

export function SectionHeading({ label, id }: { label: string; id?: string }) {
  return (
    <div id={id} className="flex items-center gap-4 mb-7 md:mb-10 scroll-mt-24">
      <Eyebrow>{label}</Eyebrow>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
    </div>
  );
}
