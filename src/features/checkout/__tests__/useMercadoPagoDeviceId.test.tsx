// @vitest-environment jsdom
/**
 * Device ID do MercadoPago.js: leitura DEFENSIVA e limitada.
 *
 * O contrato é estreito de propósito - só o valor real que o SDK publicou em
 * `window.MP_DEVICE_SESSION_ID` pode ser devolvido. UUID, localStorage ou
 * qualquer "fingerprint" caseiro seriam mentira ao provider.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMercadoPagoDeviceId } from '../useMercadoPagoDeviceId';

const OPTIONS = { attempts: 8, intervalMs: 125 } as const;

function setSessionId(value: string | undefined): void {
  if (value === undefined) delete (window as { MP_DEVICE_SESSION_ID?: string }).MP_DEVICE_SESSION_ID;
  else (window as { MP_DEVICE_SESSION_ID?: string }).MP_DEVICE_SESSION_ID = value;
}

describe('useMercadoPagoDeviceId', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setSessionId(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    setSessionId(undefined);
    vi.restoreAllMocks();
    document.getElementById('mercadopago-security-device-id')?.remove();
  });

  it('instala o script oficial de segurança como fallback do SDK V2', () => {
    renderHook(() => useMercadoPagoDeviceId(true, OPTIONS));

    const script = document.getElementById('mercadopago-security-device-id') as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.src).toBe('https://www.mercadopago.com/v2/security.js');
    expect(script?.getAttribute('view')).toBe('checkout');
  });

  it('lê um Device ID que o SDK publicou com atraso, sem inventar fallback', async () => {
    const { result } = renderHook(() => useMercadoPagoDeviceId(true, OPTIONS));

    expect(result.current).toBeNull();

    setSessionId('mp-real-id');
    await act(() => vi.advanceTimersByTimeAsync(125));

    expect(result.current).toBe('mp-real-id');
  });

  it('usa imediatamente o valor já disponível na montagem', () => {
    setSessionId('mp-ready-id');

    const { result } = renderHook(() => useMercadoPagoDeviceId(true, OPTIONS));

    expect(result.current).toBe('mp-ready-id');
  });

  it('para depois da tentativa limitada (no máximo 1s) e segue opcional', async () => {
    const { result } = renderHook(() => useMercadoPagoDeviceId(true, OPTIONS));

    await act(() => vi.advanceTimersByTimeAsync(1200));

    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('nunca fabrica um identificador a partir de UUID ou localStorage', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID');
    const readStorage = vi.spyOn(Storage.prototype, 'getItem');

    const { result } = renderHook(() => useMercadoPagoDeviceId(true, OPTIONS));
    await act(() => vi.advanceTimersByTimeAsync(1200));

    expect(result.current).toBeNull();
    expect(randomUUID).not.toHaveBeenCalled();
    expect(readStorage).not.toHaveBeenCalled();
  });

  it('ignora valor vazio, em branco ou de tipo errado publicado pelo SDK', async () => {
    setSessionId('   ');
    const { result, rerender } = renderHook(() => useMercadoPagoDeviceId(true, OPTIONS));
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(result.current).toBeNull();

    (window as unknown as { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID = 12345;
    rerender();
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(result.current).toBeNull();
  });

  it('não lê nada enquanto inativo e limpa os timers ao desligar ou desmontar', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ active }) => useMercadoPagoDeviceId(active, OPTIONS),
      { initialProps: { active: false } },
    );

    setSessionId('mp-real-id');
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    rerender({ active: true });
    expect(result.current).toBe('mp-real-id');

    rerender({ active: false });
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    setSessionId(undefined);
    rerender({ active: true });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('nunca registra o Device ID em log', async () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'debug').mockImplementation(() => undefined),
    ];
    setSessionId('mp-secret-device-id');

    const { result } = renderHook(() => useMercadoPagoDeviceId(true, OPTIONS));
    await act(() => vi.advanceTimersByTimeAsync(1200));

    expect(result.current).toBe('mp-secret-device-id');
    const logged = spies.flatMap((spy) => spy.mock.calls.flat()).join(' ');
    expect(logged).not.toContain('mp-secret-device-id');
  });
});
