/**
 * Pílula de estado.
 *
 * O tom `warn` carrega borda própria: `--warn` e `--accent` são vizinhos no
 * espectro (spec §4), e um aviso que dependesse só de cor se confundiria com
 * uma ênfase.
 */

import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';

const TONE: Record<BadgeTone, string> = {
  neutral: 'text-fg-muted bg-surface-2 border-line',
  ok: 'text-ok bg-ok/10 border-ok/30',
  warn: 'text-warn bg-warn/10 border-warn',
  danger: 'text-danger bg-danger/10 border-danger/30',
  accent: 'text-accent bg-accent/10 border-accent/30',
};

type BadgeProps = ComponentPropsWithoutRef<'span'> & {
  tone?: BadgeTone;
  children: ReactNode;
};

export function Badge({ tone = 'neutral', className = '', children, ...rest }: BadgeProps) {
  const classes = [
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-chip border',
    'text-eyebrow font-semibold uppercase',
    TONE[tone],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
