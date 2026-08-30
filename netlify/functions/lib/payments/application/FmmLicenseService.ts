/**
 * FmmLicenseService — gera/reserva/atribui a licença do FMM.
 *
 * Só ele fala com o sistema de licenças. MercadoPagoPaymentProvider NUNCA
 * gera licença; PaymentService só chama `fulfillOrder` depois de PAID.
 *
 * Fluxo idempotente:
 *   Payment PAID -> Order PAID -> procura licença da Order -> se existir,
 *   reutiliza -> se não, gera/reserva -> vincula -> entrega -> e-mail.
 */

import { generateKeyString, keyPrefixOf, sha256Hex } from '../../fmm-keygen';
import { NotFoundError } from '../domain/errors';
import type { License, LicenseStatus, Order, Product } from '../domain/types';
import { decryptLicenseKey, encryptLicenseKey } from '../infrastructure/licenseCrypto';
import {
  extendLicense,
  findLicenseByOrder,
  insertLicenseForOrder,
  listLicensesByUser,
  setLicenseStatus,
  type LicenseWithSecret,
} from '../repositories/LicenseRepository';

/** Colisão de chave é astronomicamente improvável; ainda assim, não insistimos. */
const MAX_KEY_ATTEMPTS = 5;

export type IssuedLicense = {
  license: License;
  /** Chave crua — só para exibir na tela e no e-mail. Nunca vai para log. */
  key: string | null;
  /** `true` quando a licença já existia (webhook repetido, refresh, retry). */
  reused: boolean;
};

function expiryFor(product: Product, from = new Date()): { expiresAt: string | null; durationDays: number } {
  const days = product.durationDays ?? 30;
  if (product.isLifetime) {
    // Vitalício mantém a convenção histórica (36500 dias) para que
    // fmm-activate/fmm-validate continuem aceitando a chave sem mudança.
    const expires = new Date(from);
    expires.setDate(expires.getDate() + days);
    return { expiresAt: expires.toISOString(), durationDays: days };
  }
  const expires = new Date(from);
  expires.setDate(expires.getDate() + days);
  return { expiresAt: expires.toISOString(), durationDays: days };
}

export class FmmLicenseService {
  /**
   * Garante UMA licença para o pedido.
   *
   * A unicidade é do banco, não deste código: o índice único parcial
   * `fmm_license_keys(order_id)` faz duas execuções concorrentes resultarem em
   * uma única chave — a perdedora relê a linha vencedora.
   */
  async issueForOrder(order: Order, product: Product): Promise<IssuedLicense> {
    const existing = await findLicenseByOrder(order.id);
    if (existing) {
      return { license: existing, key: decryptLicenseKey(existing.keyCiphertext), reused: true };
    }

    const { expiresAt, durationDays } = expiryFor(product);
    const level = product.fulfillmentRef ?? 'basic';

    for (let attempt = 0; attempt < MAX_KEY_ATTEMPTS; attempt += 1) {
      const rawKey = generateKeyString();
      const inserted = await insertLicenseForOrder({
        orderId: order.id,
        productId: product.id,
        userId: order.userId,
        keyHash: sha256Hex(rawKey),
        keyPrefix: keyPrefixOf(rawKey),
        keyCiphertext: encryptLicenseKey(rawKey),
        level,
        durationDays,
        expiresAt,
        notes: `Pedido ${order.reference} (${product.code})`,
        metadata: { productCode: product.code, orderReference: order.reference },
      });

      if (inserted) return { license: inserted, key: rawKey, reused: false };

      // Sem linha: ou outra execução ganhou a corrida do pedido (caso comum),
      // ou o hash colidiu (praticamente impossível). Só a primeira é esperada.
      const winner = await findLicenseByOrder(order.id);
      if (winner) {
        return { license: winner, key: decryptLicenseKey(winner.keyCiphertext), reused: true };
      }
    }

    throw new Error(`Não foi possível reservar licença para o pedido ${order.reference}`);
  }

  async findByOrder(orderId: string): Promise<IssuedLicense | null> {
    const license = await findLicenseByOrder(orderId);
    if (!license) return null;
    return { license, key: decryptLicenseKey(license.keyCiphertext), reused: true };
  }

  /** Painel do cliente: chave completa quando recuperável, prefixo sempre. */
  async listForUser(userId: string): Promise<Array<{ license: LicenseWithSecret; key: string | null }>> {
    const licenses = await listLicensesByUser(userId);
    return licenses.map((license) => ({ license, key: decryptLicenseKey(license.keyCiphertext) }));
  }

  /**
   * Renovação aprovada estende a validade. Idempotente por construção: quem
   * chama já passou pela dedup de evento, e vitalício nunca renova.
   */
  async extendForRenewal(licenseId: string, product: Product): Promise<License | null> {
    if (product.isLifetime) return null;
    return extendLicense(licenseId, product.durationDays ?? 30);
  }

  /**
   * Reembolso/chargeback NUNCA apaga a licença — só muda de estado.
   * Retorna `null` quando já estava no estado pedido (repetição de evento).
   */
  async changeStatus(orderId: string, status: LicenseStatus): Promise<License | null> {
    const license = await findLicenseByOrder(orderId);
    if (!license) return null;
    return setLicenseStatus(license.id, status);
  }

  async requireByOrder(orderId: string): Promise<IssuedLicense> {
    const found = await this.findByOrder(orderId);
    if (!found) throw new NotFoundError('Licença não encontrada para este pedido.');
    return found;
  }
}

let cached: FmmLicenseService | null = null;

export function getFmmLicenseService(): FmmLicenseService {
  return (cached ??= new FmmLicenseService());
}

export function setFmmLicenseServiceForTesting(service: FmmLicenseService | null): void {
  cached = service;
}
