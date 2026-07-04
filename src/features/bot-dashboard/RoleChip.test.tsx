// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { RoleChip } from './RoleChip';
import { roleColorToHex } from './roleColor';

afterEach(cleanup);

describe('roleColorToHex', () => {
  it('converts a Discord color int to lowercase hex', () => {
    expect(roleColorToHex(0x5865f2)).toBe('#5865f2');
  });
  it('zero-pads leading zeros', () => {
    expect(roleColorToHex(0x00ff00)).toBe('#00ff00');
  });
  it('returns null for 0, null, and undefined', () => {
    expect(roleColorToHex(0)).toBeNull();
    expect(roleColorToHex(null)).toBeNull();
    expect(roleColorToHex(undefined)).toBeNull();
  });
});

describe('RoleChip', () => {
  it('renders the role name without an @ prefix', () => {
    render(<RoleChip role={{ id: 'r1', name: 'Moderador', color: 0x5865f2 }} />);
    expect(screen.getByText('Moderador')).toBeTruthy();
    expect(screen.queryByText('@Moderador')).toBeNull();
  });
  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<RoleChip role={{ id: 'r1', name: 'Staff' }} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText('Remover Staff'));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
