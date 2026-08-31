/**
 * Botão do design system.
 *
 * Não contém texto: o site é bilíngue PT/EN e todo rótulo entra por children
 * ou prop. `loading` comunica-se por `aria-busy` e ícone — jamais injetando
 * uma string, que nasceria num idioma só.
 */

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANT: Record<ButtonVariant, string> = {
  // `brightness` em vez de um token mais claro: não existe branco puro no
  // design system, e o hover precisa elevar sem inventar cor.
  primary: 'bg-fg text-bg hover:brightness-105',
  secondary: 'bg-transparent border border-line-strong text-fg hover:border-fg/25 hover:bg-surface-2',
  ghost: 'bg-transparent text-fg-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger text-bg hover:bg-danger/85',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm gap-1.5',
  md: 'px-6 py-3 text-base gap-2',
};

const BASE =
  'inline-flex items-center justify-center font-medium rounded-full ' +
  'transition-all duration-base ease-out-token ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ' +
  'disabled:opacity-50 disabled:pointer-events-none';

type ButtonOwnProps<E extends ElementType> = {
  as?: E;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
};

type ButtonProps<E extends ElementType> = ButtonOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof ButtonOwnProps<E>>;

export function Button<E extends ElementType = 'button'>({
  as,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  ...rest
}: ButtonProps<E>) {
  const Component = (as ?? 'button') as ElementType;
  const classes = [BASE, VARIANT[variant], SIZE[size], className].filter(Boolean).join(' ');

  // `disabled` só existe em <button>; num <a> ou <Link> ele seria ignorado
  // pelo DOM, então aria-busy é o que carrega o estado nos dois casos.
  const disabledProps = Component === 'button' ? { disabled: loading || (rest as { disabled?: boolean }).disabled } : {};

  return (
    <Component className={classes} {...rest} aria-busy={loading || undefined} {...disabledProps}>
      {loading && <Loader2 aria-hidden="true" className="animate-spin" size={size === 'sm' ? 14 : 16} />}
      {children}
    </Component>
  );
}
