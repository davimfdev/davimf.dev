// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ANALYTICS_STORAGE_KEY,
  GA_MEASUREMENT_ID,
  applyConsent,
  analyticsLoaded,
  readConsent,
  writeConsent,
} from '../analyticsConsent';

const DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}`;

function gaScript(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>('script[src*="googletagmanager.com/gtag/js"]');
}

describe('consentimento de análise', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.head.innerHTML = '';
    delete (window as unknown as Record<string, unknown>)[DISABLE_FLAG];
    delete (window as unknown as Record<string, unknown>).dataLayer;
  });

  afterEach(() => {
    window.localStorage.clear();
    document.head.innerHTML = '';
  });

  it('começa sem consentimento quando nada foi decidido', () => {
    expect(readConsent()).toBe('unset');
  });

  it('trata valor desconhecido no armazenamento como não decidido', () => {
    window.localStorage.setItem(ANALYTICS_STORAGE_KEY, 'talvez');
    expect(readConsent()).toBe('unset');
  });

  it('NÃO carrega o Google Analytics enquanto a escolha não foi feita', () => {
    applyConsent('unset');
    expect(gaScript()).toBeNull();
    expect(analyticsLoaded()).toBe(false);
  });

  it('NÃO carrega o Google Analytics quando o usuário recusa', () => {
    applyConsent('denied');
    expect(gaScript()).toBeNull();
    // Flag oficial de opt-out ligada: mesmo que algo injete o script depois,
    // o GA não coleta.
    expect((window as unknown as Record<string, unknown>)[DISABLE_FLAG]).toBe(true);
  });

  it('carrega o Google Analytics somente depois do aceite', () => {
    applyConsent('granted');

    const script = gaScript();
    expect(script).not.toBeNull();
    expect(script?.src).toContain(GA_MEASUREMENT_ID);
    expect(script?.async).toBe(true);
    expect((window as unknown as Record<string, unknown>)[DISABLE_FLAG]).toBe(false);
  });

  it('não injeta o script duas vezes', () => {
    applyConsent('granted');
    applyConsent('granted');
    expect(document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]')).toHaveLength(1);
  });

  it('revogar depois de aceitar desliga a coleta na mesma sessão', () => {
    applyConsent('granted');
    expect((window as unknown as Record<string, unknown>)[DISABLE_FLAG]).toBe(false);

    applyConsent('denied');
    expect((window as unknown as Record<string, unknown>)[DISABLE_FLAG]).toBe(true);
  });

  it('persiste a escolha entre visitas', () => {
    writeConsent('granted');
    expect(readConsent()).toBe('granted');
    writeConsent('denied');
    expect(readConsent()).toBe('denied');
  });
});
