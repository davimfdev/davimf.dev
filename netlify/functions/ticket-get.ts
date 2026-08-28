// netlify/functions/ticket-get.ts
import { Config, Context } from '@netlify/functions';
import { ticketsDbSql } from './lib/db.js';

export default async (req: Request, _context: Context) => {
  const json = (b: unknown, status: number) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'id é obrigatório.' }, 400);

  try {
    const sql = ticketsDbSql;
    const rows = await sql`
      SELECT guild_name, channel_name, salt_key, salt_hash, iv, ciphertext, password_hash, iterations
      FROM tickets WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) return json({ error: 'Ticket não encontrado.' }, 404);
    const r = rows[0];
    return json({
      guildName: r.guild_name, channelName: r.channel_name,
      saltKey: r.salt_key, saltHash: r.salt_hash, iv: r.iv,
      ciphertext: r.ciphertext, passwordHash: r.password_hash, iterations: r.iterations,
    }, 200);
  } catch (err: any) {
    console.error('ticket-get:', err?.message);
    return json({ error: 'Erro interno.' }, 500);
  }
};

export const config: Config = { path: '/api/ticket' };
