// Aplica as migrations do $elfControl (db/elf/*.sql) em ordem, registrando o que já rodou.
//
//   cd server && npm run elf:migrate        (dev: lê ../.env)
//   node scripts/elf-migrate.mjs            (dentro do container davimf-api)
//
// O caminho ../../db/elf vale nos dois lugares: no repositório (server/scripts)
// e na imagem (/app/server/scripts -> /app/db/elf).
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const url = process.env.ELF_DATABASE_URL?.trim();
if (!url) {
  console.error('ELF_DATABASE_URL é obrigatório (banco selfcontrol, nunca o davimf_dev).');
  process.exit(1);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db', 'elf');
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS elf_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;

  const applied = new Set((await sql`SELECT filename FROM elf_migrations`).map((row) => row.filename));
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(join(migrationsDir, file), 'utf8');
    console.log(`aplicando ${file}`);
    // Migration e registro na mesma transação: aplicada sem registro rodaria de novo.
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO elf_migrations (filename) VALUES (${file})`;
    });
    count += 1;
  }

  console.log(count === 0 ? 'nada pendente' : `${count} migration(s) aplicada(s)`);
} catch (error) {
  console.error('falha ao migrar:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
