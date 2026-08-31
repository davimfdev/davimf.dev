/**
 * Painel do design system — substitui `.glass-panel`.
 *
 * As superfícies são opacas (spec §3.2): o hover é uma troca de token, não
 * uma soma de transparências que se acumularia em aninhamento.
 */

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

export type SurfaceLevel = 1 | 2 | 3;
export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

const LEVEL: Record<SurfaceLevel, string> = {
  1: 'bg-surface-1',
  2: 'bg-surface-2',
  3: 'bg-surface-3',
};

const HOVER: Record<SurfaceLevel, string> = {
  1: 'hover:bg-surface-2 hover:border-line-strong',
  2: 'hover:bg-surface-3 hover:border-line-strong',
  3: 'hover:border-line-strong',
};

const PADDING: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-10',
};

type SurfaceOwnProps<E extends ElementType> = {
  as?: E;
  level?: SurfaceLevel;
  padding?: SurfacePadding;
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
};

type SurfaceProps<E extends ElementType> = SurfaceOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof SurfaceOwnProps<E>>;

export function Surface<E extends ElementType = 'div'>({
  as,
  level = 1,
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}: SurfaceProps<E>) {
  const Component = (as ?? 'div') as ElementType;
  const classes = [
    'border border-line rounded-panel relative overflow-hidden',
    'transition-all duration-base ease-out-token',
    LEVEL[level],
    PADDING[padding],
    interactive ? HOVER[level] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
