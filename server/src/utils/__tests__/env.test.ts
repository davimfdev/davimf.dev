import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCompatibilityEnv, normalizeSiteUrl, warnMissingEnv } from '../env';

/** Nomes que os testes mexem; restaurados um a um para não vazar entre casos. */
const TOUCHED = [
  'URL', 'PUBLIC_SITE_URL', 'SITE_URL', 'APP_URL',
  'COOLIFY_URL', 'COOLIFY_FQDN', 'SERVICE_FQDN_API', 'SERVICE_FQDN_WEB',
  'ABACATEPAY_KEY', 'PAYMENTS_PROVIDER', 'PAYMENTS_ENV',
  'PAYMENTS_PAYER_ENCRYPTION_KEY', 'MERCADOPAGO_APPLICATION_ID',
  'MERCADOPAGO_WEBHOOK_SECRET_TEST', 'MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION',
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(TOUCHED.map((name) => [name, process.env[name]]));
  for (const name of TOUCHED) delete process.env[name];
});

afterEach(() => {
  for (const name of TOUCHED) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  vi.restoreAllMocks();
});

describe('normalizeSiteUrl', () => {
  it('mantém uma URL já correta', () => {
    expect(normalizeSiteUrl('https://davimf.dev')).toBe('https://davimf.dev');
  });

  it('remove barra final — os consumidores concatenam direto', () => {
    expect(normalizeSiteUrl('https://davimf.dev/')).toBe('https://davimf.dev');
    expect(normalizeSiteUrl('https://davimf.dev///')).toBe('https://davimf.dev');
  });

  it('assume https quando a plataforma dá só o host (Coolify FQDN)', () => {
    expect(normalizeSiteUrl('davimf.dev')).toBe('https://davimf.dev');
  });

  it('preserva esquema e porta de desenvolvimento', () => {
    expect(normalizeSiteUrl('http://localhost:8888')).toBe('http://localhost:8888');
  });

  it('preserva subcaminho, sem barra final', () => {
    expect(normalizeSiteUrl('https://davimf.dev/app/')).toBe('https://davimf.dev/app');
  });

  it('ignora espaços em volta', () => {
    expect(normalizeSiteUrl('  https://davimf.dev  ')).toBe('https://davimf.dev');
  });

  it('devolve null para valor vazio ou inutilizável', () => {
    expect(normalizeSiteUrl(undefined)).toBeNull();
    expect(normalizeSiteUrl('')).toBeNull();
    expect(normalizeSiteUrl('   ')).toBeNull();
    expect(normalizeSiteUrl('https://')).toBeNull();
  });
});

describe('applyCompatibilityEnv', () => {
  it('usa URL do ambiente e normaliza', () => {
    process.env.URL = 'https://davimf.dev/';
    expect(applyCompatibilityEnv()).toBe('https://davimf.dev');
    expect(process.env.URL).toBe('https://davimf.dev');
  });

  it('URL tem precedência sobre todos os apelidos', () => {
    process.env.URL = 'https://davimf.dev';
    process.env.PUBLIC_SITE_URL = 'https://errado.example';
    process.env.COOLIFY_FQDN = 'errado.example';
    expect(applyCompatibilityEnv()).toBe('https://davimf.dev');
  });

  it('cai para PUBLIC_SITE_URL quando URL não existe', () => {
    process.env.PUBLIC_SITE_URL = 'https://davimf.dev';
    expect(applyCompatibilityEnv()).toBe('https://davimf.dev');
    expect(process.env.URL).toBe('https://davimf.dev');
  });

  it('aceita os apelidos do Coolify, inclusive host puro', () => {
    process.env.COOLIFY_FQDN = 'davimf.dev';
    expect(applyCompatibilityEnv()).toBe('https://davimf.dev');
  });

  it('aceita SERVICE_FQDN_* gerado pelo Coolify', () => {
    process.env.SERVICE_FQDN_API = 'davimf.dev';
    expect(applyCompatibilityEnv()).toBe('https://davimf.dev');
  });

  it('respeita a ordem de precedência entre apelidos', () => {
    process.env.APP_URL = 'https://terceiro.example';
    process.env.SITE_URL = 'https://segundo.example';
    process.env.PUBLIC_SITE_URL = 'https://primeiro.example';
    expect(applyCompatibilityEnv()).toBe('https://primeiro.example');
  });

  it('devolve null e limpa URL inutilizável em vez de propagar link quebrado', () => {
    process.env.URL = '   ';
    expect(applyCompatibilityEnv()).toBeNull();
    expect(process.env.URL).toBeUndefined();
  });
});

describe('warnMissingEnv', () => {
  it('não reclama de URL quando ela está resolvida', () => {
    process.env.URL = 'https://davimf.dev';
    applyCompatibilityEnv();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    warnMissingEnv();

    const output = warn.mock.calls.flat().join('\n');
    expect(output).not.toContain('URL pública não definida');
    expect(output).not.toMatch(/^\s+- URL \(/m);
  });

  it('explica como definir a URL quando ela falta', () => {
    applyCompatibilityEnv();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    warnMissingEnv();

    const output = warn.mock.calls.flat().join('\n');
    expect(output).toContain('URL pública não definida');
    expect(output).toContain('URL=https://davimf.dev');
    expect(output).toContain('PUBLIC_SITE_URL');
  });

  it('a MESMA assinatura nas duas variáveis é normal: o MP gera uma por aplicação', () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET_TEST = 'a-assinatura-da-aplicacao';
    process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION = 'a-assinatura-da-aplicacao';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    warnMissingEnv();

    const output = warn.mock.calls.flat().join('\n');
    expect(output).not.toContain('MERCADOPAGO_WEBHOOK_SECRET');
    expect(output).not.toContain('a-assinatura-da-aplicacao');
  });

  it('ABACATEPAY_KEY é opcional: nunca entra na lista de ausentes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const missing = warnMissingEnv();

    expect(missing.some((entry) => entry.startsWith('ABACATEPAY_KEY'))).toBe(false);
    expect(warn.mock.calls.flat().join('\n')).not.toContain('ABACATEPAY_KEY');
    expect(info.mock.calls.flat().join('\n')).toContain('ABACATEPAY_KEY');
  });

  it('PAYMENTS_PROVIDER e PAYMENTS_ENV são opcionais (têm padrão no código)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const missing = warnMissingEnv();

    expect(missing.some((entry) => entry.startsWith('PAYMENTS_PROVIDER'))).toBe(false);
    expect(missing.some((entry) => entry.startsWith('PAYMENTS_ENV'))).toBe(false);
  });

  it('a chave do perfil é opcional para pagamentos e informada sem revelar valor', () => {
    process.env.PAYMENTS_PAYER_ENCRYPTION_KEY = 'segredo-que-nao-pode-aparecer';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const missingWithKey = warnMissingEnv();

    expect(missingWithKey.some((entry) => entry.startsWith('PAYMENTS_PAYER_ENCRYPTION_KEY'))).toBe(false);
    expect([...warn.mock.calls, ...info.mock.calls].flat().join('\n')).not.toContain(process.env.PAYMENTS_PAYER_ENCRYPTION_KEY);

    delete process.env.PAYMENTS_PAYER_ENCRYPTION_KEY;
    warnMissingEnv();
    expect(info.mock.calls.flat().join('\n')).toContain('PAYMENTS_PAYER_ENCRYPTION_KEY');
  });
});
