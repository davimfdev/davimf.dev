import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetPoolsForTesting } from '../../../lib/db';
import { sql, withTransaction } from '../db';

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {
    ELF_DATABASE_URL: process.env.ELF_DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
  };
  delete process.env.ELF_DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://postgres:5432/davimf_dev';
  resetPoolsForTesting();
});

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  resetPoolsForTesting();
});

describe('banco do $elfControl', () => {
  it('exige ELF_DATABASE_URL mesmo com o banco do site configurado', () => {
    expect(() => sql`SELECT 1`).toThrow('ELF_DATABASE_URL');
  });

  it('a transação também exige ELF_DATABASE_URL', async () => {
    await expect(withTransaction(async () => 'ok')).rejects.toThrow('ELF_DATABASE_URL');
  });
});
