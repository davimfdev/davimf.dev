/**
 * A identidade de uma licença é um UUID.
 *
 * `fmm_license_keys` é anterior ao módulo de pagamentos e sua chave primária
 * sempre foi `uuid`. O módulo tipava `License.id` como `number` e mapeava com
 * `num()`, que devolve o fallback `0` para o que não converte — então TODA
 * licença carregada virava `id: 0`, e qualquer operação chaveada por id batia
 * no banco como `WHERE id = 0`, com o Postgres estourando
 * `invalid input syntax for type uuid: "0"`.
 *
 * Isso quebrava, em silêncio ou em erro: revogação no reembolso, suspensão em
 * contestação e extensão na renovação. Nenhum teste pegava porque o fixture
 * usava `id: 42`, um número que o schema real nunca produziria.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FmmLicenseService } from '../application/FmmLicenseService';
import { rowToLicense } from '../repositories/LicenseRepository';
import { FakeSql, licenseRow, uninstallSql } from './helpers';

const LICENSE_UUID = '5a0f89c9-7d5c-4dbb-9d45-60ae3284c677';
const ORDER_UUID = 'f5e1c096-ce35-47ba-9ca6-eed071711608';

describe('identidade da licença', () => {
  let sql: FakeSql;

  beforeEach(() => {
    sql = new FakeSql();
    sql.install();
  });

  afterEach(() => uninstallSql());

  it('preserva o UUID vindo do banco em vez de zerá-lo', () => {
    const license = rowToLicense(licenseRow({ id: LICENSE_UUID }));
    expect(license.id).toBe(LICENSE_UUID);
  });

  it('revoga usando o UUID da licença, não um id numérico', async () => {
    sql.use([
      {
        match: (query) => query.includes('FROM fmm_license_keys WHERE order_id'),
        rows: [licenseRow({ id: LICENSE_UUID, order_id: ORDER_UUID })],
      },
      {
        match: (query) => query.includes('UPDATE fmm_license_keys'),
        rows: [licenseRow({ id: LICENSE_UUID, order_id: ORDER_UUID, status: 'REVOKED' })],
      },
    ]);

    const changed = await new FmmLicenseService().changeStatus(ORDER_UUID, 'REVOKED');

    expect(changed?.status).toBe('REVOKED');
    // O valor que foi ao banco no UPDATE precisa ser o UUID. Antes da correção
    // era `0`, e o Postgres recusava a consulta inteira.
    const [update] = sql.queriesMatching('UPDATE fmm_license_keys');
    expect(update).toBeDefined();
    expect(update.values).toContain(LICENSE_UUID);
    expect(update.values).not.toContain(0);
  });
});
