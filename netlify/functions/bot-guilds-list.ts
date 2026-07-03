import { Handler } from '@netlify/functions';
import { botSql } from './lib/botDb';

// Lista as guilds do usuário marcando quais são configuráveis (dono + bot presente).
export const handler: Handler = async (event) => {
  const auth = event.headers.authorization || (event.headers as any).Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  const token = auth.slice('Bearer '.length);

  const res = await fetch('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: 'Discord guilds fetch failed' }) };
  const guilds = (await res.json()) as Array<{ id: string; name: string; owner?: boolean; icon?: string }>;

  const owned = guilds.filter((g) => g.owner === true);
  if (owned.length === 0) return { statusCode: 200, body: JSON.stringify([]) };

  const ids = owned.map((g) => g.id);
  const present = await botSql`SELECT guild_id FROM bot_guilds WHERE bot_present = true AND guild_id = ANY(${ids})`;
  const presentIds = new Set(present.map((row) => String(row.guild_id)));

  const out = owned.map((g) => ({ ...g, hasBot: presentIds.has(String(g.id)) }));
  return { statusCode: 200, body: JSON.stringify(out) };
};
