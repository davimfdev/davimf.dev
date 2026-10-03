import { ELF_DB_ENV, sqlFor, transactionFor, type SqlRow } from '../../lib/db';

export type ElfSql = <T = SqlRow>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;
export type ElfTransaction = <T>(fn: (tx: ElfSql) => Promise<T>) => Promise<T>;

/**
 * Statement avulso no pool compartilhado do servidor (postgres.js sobre TCP).
 * O tipo genérico só nomeia as colunas esperadas; quem precisa de garantia em
 * runtime (dinheiro, por exemplo) valida a linha, como em `money.ts`.
 */
export const sql = sqlFor(ELF_DB_ENV) as ElfSql;

/** Operação composta: tudo grava junto ou nada grava. */
export const withTransaction = transactionFor(ELF_DB_ENV) as ElfTransaction;
