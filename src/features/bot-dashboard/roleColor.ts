export function roleColorToHex(color?: number | null): string | null {
  if (color == null || color === 0) return null;
  return '#' + (color & 0xffffff).toString(16).padStart(6, '0');
}
