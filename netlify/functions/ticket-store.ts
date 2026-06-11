// netlify/functions/ticket-store.ts
import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';

const REQUIRED = [
  'id', 'source', 'guildName', 'channelName',
  'saltKey', 'saltHash', 'iv', 'ciphertext', 'passwordHash', 'iterations',
] as const;

export default async (req: Request, _context: Context) => {
  const json = (b: unknown, status: number) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  if (req.headers.get('x-ticket-secret') !== process.env.TICKET_INGEST_SECRET)
    return json({ error: 'Não autorizado.' }, 401);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
  for (const f of REQUIRED) {
    if (b[f] === undefined || b[f] === null || b[f] === '')
      return json({ error: `Campo obrigatório ausente: ${f}` }, 400);
  }

  try {
    const sql = neon(process.env.TICKETS_NEON!);
    await sql`
      INSERT INTO tickets
        (id, source, guild_name, channel_name, salt_key, salt_hash, iv, ciphertext, password_hash, iterations)
      VALUES
        (${b.id}, ${b.source}, ${b.guildName}, ${b.channelName}, ${b.saltKey}, ${b.saltHash},
         ${b.iv}, ${b.ciphertext}, ${b.passwordHash}, ${b.iterations})`;
    return json({ id: b.id }, 200);
  } catch (err: any) {
    if (String(err?.message ?? '').includes('duplicate key'))
      return json({ error: 'Ticket já existe.' }, 409);
    console.error('ticket-store:', err?.message);
    return json({ error: 'Erro interno.' }, 500);
  }
};

export const config: Config = { path: '/api/ticket-store' };
