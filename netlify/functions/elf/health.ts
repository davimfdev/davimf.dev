import { sql, type ElfSql } from './lib/db';
import { jsonResponse, withElf } from './lib/http';

/** GET /api/elf/health — confirma que a API alcança o banco do $elfControl. */
export async function handleHealth(req: Request, deps: { sql?: ElfSql } = {}): Promise<Response> {
  const query = deps.sql ?? sql;
  try {
    await query`SELECT 1`;
  } catch (error) {
    console.error('[elf] health: banco indisponível', {
      message: error instanceof Error ? error.message : 'desconhecido',
    });
    return jsonResponse(
      { status: 'degraded', database: 'error', time: new Date().toISOString() },
      503,
      req,
    );
  }
  return jsonResponse({ status: 'ok', database: 'ok', time: new Date().toISOString() }, 200, req);
}

export default withElf((req) => handleHealth(req));
