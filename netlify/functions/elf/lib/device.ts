import cookie from 'cookie';
import { signToken, verifySignedToken } from './crypto';
import type { ElfSql } from './db';

export const ELF_DEVICE_COOKIE = 'elf_device';
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 3600;

/** Vida longa e independente da sessão: sobrevive ao logout para o navegador reaparecer como o mesmo dispositivo. */
export function deviceCookie(deviceId: string, secure: boolean): string {
  return cookie.serialize(ELF_DEVICE_COOKIE, signToken(deviceId), {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/elf',
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
}

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad/, 'iOS'],
  [/Mac OS X/, 'macOS'],
  [/Linux/, 'Linux'],
];

/** Heurística legível, não fingerprinting. O usuário pode renomear depois. */
export function deviceNameFromUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Navegador';
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && system) return `${browser} no ${system}`;
  if (browser) return browser;
  return 'Navegador';
}

export async function resolveWebDevice(
  input: { userId: string; cookieHeader: string | null; userAgent: string | null },
  deps: { sql: ElfSql },
): Promise<{ deviceId: string; isNew: boolean }> {
  const signed = cookie.parse(input.cookieHeader ?? '')[ELF_DEVICE_COOKIE];
  const candidate = signed ? verifySignedToken(signed) : null;

  if (candidate) {
    // O filtro por user_id impede que dois usuários no mesmo navegador
    // compartilhem dispositivo. Cookie de outro dono é tratado como ausente.
    const rows = await deps.sql<{ id: string }>`
      SELECT id FROM devices
       WHERE id = ${candidate} AND user_id = ${input.userId} AND revoked_at IS NULL
       LIMIT 1`;
    const existing = rows[0];
    if (existing) return { deviceId: existing.id, isNew: false };
  }

  const created = await deps.sql<{ id: string }>`
    INSERT INTO devices (user_id, name, platform)
    VALUES (${input.userId}, ${deviceNameFromUserAgent(input.userAgent)}, 'web')
    RETURNING id`;
  const device = created[0];
  if (!device) throw new Error('INSERT em devices não devolveu id');
  return { deviceId: device.id, isNew: true };
}
