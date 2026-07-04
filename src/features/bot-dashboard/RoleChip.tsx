import type { CSSProperties } from 'react';
import { roleColorToHex } from './roleColor';
import type { RoleOption } from './types';

export function RoleChip({ role, onRemove }: { role: RoleOption; onRemove?: () => void }) {
  const hex = roleColorToHex(role.color);
  const style = hex ? ({ ['--chip']: hex } as CSSProperties) : undefined;
  return (
    <span className="bd-role-chip" style={style} data-neutral={hex ? undefined : ''}>
      <span className="bd-role-dot" aria-hidden />
      <span className="bd-role-name">{role.name}</span>
      {onRemove && (
        <button type="button" className="bd-role-remove" aria-label={`Remover ${role.name}`} onClick={onRemove}>✕</button>
      )}
    </span>
  );
}
