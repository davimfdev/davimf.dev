import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FmmLicenseService } from '../application/FmmLicenseService';
import { rowToOrder } from '../repositories/OrderRepository';
import { rowToProduct } from '../repositories/ProductRepository';
import { FakeSql, licenseRow, orderRow, productRow, uninstallSql } from './helpers';

const ORDER = rowToOrder(orderRow({ status: 'PAID' }));
const PRODUCT = rowToProduct(productRow());

describe('FmmLicenseService', () => {
  let sql: FakeSql;

  beforeEach(() => {
    // Cifra recuperável: usa o mesmo mecanismo AES-256-GCM do dashboard.
    process.env.PAYMENTS_LICENSE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    sql = new FakeSql();
    sql.install();
  });

  afterEach(() => {
    uninstallSql();
    delete process.env.PAYMENTS_LICENSE_ENCRYPTION_KEY;
  });

  it('gera e reserva a chave do pedido pago', async () => {
    let inserted: Record<string, unknown> | null = null;

    sql.use([
      { match: (q) => q.includes('SELECT') && q.includes('WHERE order_id ='), rows: () => (inserted ? [inserted] : []) },
      {
        match: (q) => q.includes('INSERT INTO fmm_license_keys'),
        rows: (_q, values) => {
          inserted = licenseRow({ key_prefix: String(values[1]), key_ciphertext: values[2] as string });
          return [inserted];
        },
      },
    ]);

    const result = await new FmmLicenseService().issueForOrder(ORDER, PRODUCT);

    expect(result.reused).toBe(false);
    expect(result.key).toMatch(/^FMM-[0-9A-F]{8}-[0-9A-F]{8}$/);
    expect(result.license.status).toBe('ACTIVE');

    // O banco guarda HASH e cifra — nunca a chave crua em claro.
    const insert = sql.queriesMatching('INSERT INTO fmm_license_keys')[0];
    expect(insert.values).not.toContain(result.key);
    expect(String(insert.values[0])).toMatch(/^[0-9a-f]{64}$/);
  });

  it('NÃO gera uma segunda chave para o mesmo pedido — reutiliza a existente', async () => {
    const existing = licenseRow();
    sql.use([
      { match: (q) => q.includes('SELECT') && q.includes('WHERE order_id ='), rows: [existing] },
      { match: (q) => q.includes('INSERT INTO fmm_license_keys'), rows: [] },
    ]);

    const first = await new FmmLicenseService().issueForOrder(ORDER, PRODUCT);
    const second = await new FmmLicenseService().issueForOrder(ORDER, PRODUCT);

    expect(first.reused).toBe(true);
    expect(second.reused).toBe(true);
    expect(sql.queriesMatching('INSERT INTO fmm_license_keys')).toHaveLength(0);
  });

  it('perde a corrida do índice único e recupera a chave vencedora', async () => {
    const winner = licenseRow({ key_prefix: 'FMM-WINNER01' });
    let attempted = false;

    sql.use([
      {
        match: (q) => q.includes('SELECT') && q.includes('WHERE order_id ='),
        // Primeira leitura: ainda não existe. Depois do INSERT frustrado: existe.
        rows: () => (attempted ? [winner] : []),
      },
      {
        match: (q) => q.includes('INSERT INTO fmm_license_keys'),
        rows: () => {
          attempted = true;
          return []; // ON CONFLICT (order_id) DO NOTHING
        },
      },
    ]);

    const result = await new FmmLicenseService().issueForOrder(ORDER, PRODUCT);

    expect(result.reused).toBe(true);
    expect(result.license.keyPrefix).toBe('FMM-WINNER01');
    expect(sql.queriesMatching('INSERT INTO fmm_license_keys')).toHaveLength(1);
  });

  it('a chave permanece recuperável depois (cifra ida e volta)', async () => {
    let stored: Record<string, unknown> | null = null;

    sql.use([
      { match: (q) => q.includes('SELECT') && q.includes('WHERE order_id ='), rows: () => (stored ? [stored] : []) },
      {
        match: (q) => q.includes('INSERT INTO fmm_license_keys'),
        rows: (_q, values) => {
          stored = licenseRow({ key_ciphertext: values[2] as string });
          return [stored];
        },
      },
    ]);

    const service = new FmmLicenseService();
    const issued = await service.issueForOrder(ORDER, PRODUCT);
    const recovered = await service.findByOrder(ORDER.id);

    expect(recovered?.key).toBe(issued.key);
  });

  it('reembolso REVOGA sem apagar; contestação SUSPENDE', async () => {
    sql.use([
      { match: (q) => q.includes('SELECT') && q.includes('WHERE order_id ='), rows: [licenseRow()] },
      { match: (q) => q.includes('UPDATE fmm_license_keys'), rows: (_q, values) => [licenseRow({ status: values[0] })] },
    ]);

    const service = new FmmLicenseService();
    expect((await service.changeStatus(ORDER.id, 'REVOKED'))?.status).toBe('REVOKED');
    expect((await service.changeStatus(ORDER.id, 'SUSPENDED'))?.status).toBe('SUSPENDED');

    // Nenhum DELETE em lugar nenhum do caminho.
    expect(sql.queriesMatching('DELETE')).toHaveLength(0);
  });

  it('vitalício nunca renova', async () => {
    const lifetime = rowToProduct(productRow({ is_lifetime: true, recurring_eligible: false, duration_days: 36500 }));
    const extended = await new FmmLicenseService().extendForRenewal(42, lifetime);
    expect(extended).toBeNull();
    expect(sql.queriesMatching('UPDATE fmm_license_keys')).toHaveLength(0);
  });

  it('renovação de plano temporário estende a validade', async () => {
    sql.use([
      { match: (q) => q.includes('UPDATE fmm_license_keys'), rows: [licenseRow({ expires_at: '2026-10-01T00:00:00.000Z' })] },
    ]);
    const extended = await new FmmLicenseService().extendForRenewal(42, PRODUCT);
    expect(extended?.expiresAt).toBe('2026-10-01T00:00:00.000Z');
    expect(sql.queriesMatching('UPDATE fmm_license_keys')[0].values).toContain(30);
  });
});
