import { afterEach, describe, expect, it, vi } from 'vitest';
import { logOrderAccessDenied } from '../infrastructure/securityLog';

afterEach(() => vi.restoreAllMocks());

describe('log de segurança', () => {
  it('registra a tentativa com usuário e pedido, em linha única', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    logOrderAccessDenied({ userId: 'user-1', orderId: 'ord-alheio' });

    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls.flat().join(' ');
    expect(line).toContain('[security] ORDER_ACCESS_DENIED');
    expect(line).toContain('user=user-1');
    expect(line).toContain('order=ord-alheio');
  });
});
