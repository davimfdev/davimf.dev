/**
 * Superfície pública do design system.
 *
 * Código novo importa daqui: `import { Button, Surface } from '../components/ui'`.
 * As classes legadas (`.glass-panel`, `.btn-*`) continuam funcionando, mas são
 * camada de compatibilidade — ver `src/index.css`.
 */

export { Button } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';

export { Surface } from './Surface';
export type { SurfaceLevel, SurfacePadding } from './Surface';

export { Field } from './Field';
export type { FieldControlProps } from './Field';

export { Badge } from './Badge';
export type { BadgeTone } from './Badge';

export { Eyebrow } from './Eyebrow';
