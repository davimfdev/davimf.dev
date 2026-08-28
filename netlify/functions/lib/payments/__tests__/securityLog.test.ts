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

  it('sanitiza caracteres de controle para evitar injeção de log', () => {
    // Tentativa de injetar uma segunda linha de log falsa com newline e [security].
    // Deve produzir exatamente UMA chamada a console.warn, sem linhas falsas.
    // Caracteres de controle (inclusive \n) são removidos; orderId fica com o
    // resto do texto, mas não cria um novo registro de log.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    logOrderAccessDenied({
      userId: 'user-1',
      orderId: 'ord-alheio\n[security] ORDER_ACCESS_DENIED user=admin',
    });

    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls.flat().join(' ');
    // Deve conter os dados autênticos
    expect(line).toContain('[security] ORDER_ACCESS_DENIED');
    expect(line).toContain('user=user-1');
    // O orderId não deve conter newline (a injeção foi neutralizada)
    expect(line).not.toContain('\n');
  });
});
