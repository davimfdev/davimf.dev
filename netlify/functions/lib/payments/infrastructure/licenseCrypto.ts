/**
 * Cifra da cópia recuperável da chave de licença.
 *
 * A tabela `fmm_license_keys` guarda o HASH da chave (é ele que valida a
 * ativação) - hash não volta atrás, então a chave não poderia ser reexibida no
 * painel. Guardamos também uma cópia cifrada com AES-256-GCM reutilizando o
 * mesmo mecanismo de lib/dashboard/crypto.ts, para que o e-mail não seja o
 * único lugar onde a licença existe.
 *
 * A chave crua NUNCA vai para log.
 */

import { decryptToken, encryptToken } from '../../dashboard/crypto';

/** Chave dedicada quando existir; senão a do dashboard, que já é obrigatória. */
function withKeyEnv<T>(run: () => T): T {
  const dedicated = process.env.PAYMENTS_LICENSE_ENCRYPTION_KEY;
  if (!dedicated) return run();

  const previous = process.env.DASHBOARD_TOKEN_ENCRYPTION_KEY;
  process.env.DASHBOARD_TOKEN_ENCRYPTION_KEY = dedicated;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.DASHBOARD_TOKEN_ENCRYPTION_KEY;
    else process.env.DASHBOARD_TOKEN_ENCRYPTION_KEY = previous;
  }
}

/** `null` quando não há chave de cifra configurada - a venda não pode parar por isso. */
export function encryptLicenseKey(rawKey: string): string | null {
  try {
    return withKeyEnv(() => encryptToken(rawKey));
  } catch (error) {
    console.error('[payments] cifra da licença indisponível; chave salva só como hash:', (error as Error).message);
    return null;
  }
}

/** `null` quando não há cifra guardada ou a chave de cifra mudou. */
export function decryptLicenseKey(ciphertext: string | null): string | null {
  if (!ciphertext) return null;
  try {
    return withKeyEnv(() => decryptToken(ciphertext));
  } catch {
    return null;
  }
}
