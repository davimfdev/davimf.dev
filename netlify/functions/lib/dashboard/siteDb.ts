import { neon } from '@neondatabase/serverless';
import type { DashboardSql, SqlRow } from '../botDb';

type NeonSql = ReturnType<typeof neon>;
let cached: NeonSql | null = null;

function client(): NeonSql {
  const url = process.env.NETLIFY_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('NETLIFY_DATABASE_URL or DATABASE_URL is required');
  return (cached ??= neon(url));
}

export const siteSql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  client()(strings, ...values) as Promise<SqlRow[]>) as DashboardSql;
