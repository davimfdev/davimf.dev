/**
 * Rótulo técnico: pequeno, espaçado, em caixa alta.
 *
 * É a assinatura tipográfica da direção "technical" — nomeia uma seção sem
 * competir com o título.
 */

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

type EyebrowOwnProps<E extends ElementType> = {
  as?: E;
  className?: string;
  children?: ReactNode;
};

type EyebrowProps<E extends ElementType> = EyebrowOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof EyebrowOwnProps<E>>;

export function Eyebrow<E extends ElementType = 'span'>({
  as,
  className = '',
  children,
  ...rest
}: EyebrowProps<E>) {
  const Component = (as ?? 'span') as ElementType;
  const classes = ['text-eyebrow font-semibold uppercase text-fg-muted', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
