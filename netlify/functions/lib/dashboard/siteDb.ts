// Banco do site (`davimf_dev`) na ótica do dashboard: precedência
// `NETLIFY_DATABASE_URL` → `DATABASE_URL`, a mesma de antes.
//
// Conexão TCP com pool via lib/db.ts (ver o porquê da migração lá).
import { authDbSql } from '../db';
import type { DashboardSql } from '../botDb';

export const siteSql: DashboardSql = authDbSql;
