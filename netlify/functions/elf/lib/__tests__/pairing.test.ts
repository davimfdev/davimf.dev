import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generatePairingCode,
  normalizeCode,
  formatCode,
  generatePollToken,
  signPollToken,
  verifyPollToken,
  encryptSessionToken,
  decryptSessionToken,
  PAIRING_CODE_PATTERN,
} from '../pairing';

afterEach(() => vi.unstubAllEnvs());

describe('código de pareamento', () => {
  it('tem 6 caracteres do alfabeto sem ambiguidade', () => {
    const codes = Array.from({ length: 300 }, () => generatePairingCode());
    expect(codes.every((code) => PAIRING_CODE_PATTERN.test(code))).toBe(true);
    expect(codes.some((code) => /[01OIL]/.test(code))).toBe(false);
  });
  it('gera códigos diferentes', () => {
    const gerados = new Set(Array.from({ length: 50 }, () => generatePairingCode()));
    expect(gerados.size).toBeGreaterThan(45);
  });
  it('normaliza hífen, espaço e caixa', () => {
    expect(normalizeCode(' k7m-2qx ')).toBe('K7M2QX');
  });
  it('formata em dois grupos de três', () => {
    expect(formatCode('K7M2QX')).toBe('K7M-2QX');
  });
  it('normalizar o formatado devolve o original', () => {
    const code = generatePairingCode();
    expect(normalizeCode(formatCode(code))).toBe(code);
  });
});

describe('pollToken', () => {
  it('roundtrip devolve o token', () => {
    const token = generatePollToken();
    expect(verifyPollToken(signPollToken(token))).toBe(token);
  });
  it('recusa assinatura adulterada', () => {
    expect(verifyPollToken(`${signPollToken(generatePollToken())}x`)).toBeNull();
  });
  it('recusa valor sem assinatura', () => {
    expect(verifyPollToken(generatePollToken())).toBeNull();
  });
  it('recusa token assinado com outro segredo', () => {
    const assinado = signPollToken(generatePollToken());
    vi.stubEnv('ELF_PAIRING_SIGNING_SECRET', 'z'.repeat(48));
    expect(verifyPollToken(assinado)).toBeNull();
  });
  it('exige segredo de assinatura com 32 bytes', () => {
    vi.stubEnv('ELF_PAIRING_SIGNING_SECRET', 'curto');
    expect(() => signPollToken('x')).toThrow('ELF_PAIRING_SIGNING_SECRET');
  });
});

describe('cifragem do token de sessão', () => {
  it('roundtrip devolve o texto original', () => {
    const cifrado = encryptSessionToken('sessao.assinada', 'pairing-1');
    expect(decryptSessionToken(cifrado, 'pairing-1')).toBe('sessao.assinada');
  });
  it('usa o formato versionado v1.iv.ciphertext.tag', () => {
    const partes = encryptSessionToken('sessao.assinada', 'pairing-1').split('.');
    expect(partes).toHaveLength(4);
    expect(partes[0]).toBe('v1');
  });
  it('gera iv novo a cada operação', () => {
    expect(encryptSessionToken('mesmo', 'pairing-1')).not.toBe(encryptSessionToken('mesmo', 'pairing-1'));
  });
  it('não deixa o texto aparecer no ciphertext', () => {
    expect(encryptSessionToken('sessao-abc', 'pairing-1')).not.toContain('sessao-abc');
  });
  it('recusa decifragem com AAD de outro pareamento', () => {
    const cifrado = encryptSessionToken('sessao.assinada', 'pairing-1');
    expect(() => decryptSessionToken(cifrado, 'pairing-2')).toThrow();
  });
  it('recusa ciphertext adulterado', () => {
    const [v, iv, ct = '', tag] = encryptSessionToken('sessao.assinada', 'pairing-1').split('.');
    // Troca o primeiro caractere: acrescentar um no fim pode ser descartado pelo
    // decodificador base64 e deixar os bytes iguais.
    const adulterado = `${ct.startsWith('A') ? 'B' : 'A'}${ct.slice(1)}`;
    expect(() => decryptSessionToken(`${v}.${iv}.${adulterado}.${tag}`, 'pairing-1')).toThrow();
  });
  it('recusa tag adulterada', () => {
    const [v, iv, ct] = encryptSessionToken('sessao.assinada', 'pairing-1').split('.');
    expect(() => decryptSessionToken(`${v}.${iv}.${ct}.AAAAAAAAAAAAAAAAAAAAAA`, 'pairing-1')).toThrow();
  });
  it('recusa número errado de partes', () => {
    expect(() => decryptSessionToken('v1.abc.def', 'pairing-1')).toThrow();
    expect(() => decryptSessionToken('v1.a.b.c.d', 'pairing-1')).toThrow();
  });
  it('recusa versão desconhecida', () => {
    const [, iv, ct, tag] = encryptSessionToken('sessao.assinada', 'pairing-1').split('.');
    expect(() => decryptSessionToken(`v9.${iv}.${ct}.${tag}`, 'pairing-1')).toThrow();
  });
  it('não decifra com outro segredo de cifragem', () => {
    const cifrado = encryptSessionToken('sessao.assinada', 'pairing-1');
    vi.stubEnv('ELF_PAIRING_ENCRYPTION_SECRET', 'w'.repeat(48));
    expect(() => decryptSessionToken(cifrado, 'pairing-1')).toThrow();
  });
});
