import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const getDiscordId = async (authHeader: string | null | undefined): Promise<string | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const res = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  } catch { return null; }
};

export const handler: Handler = async (event) => {
  const discordId = await getDiscordId(event.headers.authorization);
  if (!discordId) return { statusCode: 401, body: 'Unauthorized' };

  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    switch (method) {
      case 'GET': {
        const accounts = await sql`SELECT * FROM accounts WHERE user_id = ${discordId} ORDER BY name ASC`;
        return { statusCode: 200, body: JSON.stringify(accounts) };
      }
      case 'POST': {
        const [newAccount] = await sql`
          INSERT INTO accounts (user_id, name, currency, type, initial_balance)
          VALUES (${discordId}, ${body.name}, ${body.currency || 'BRL'}, ${body.type}, ${body.initial_balance || 0})
          RETURNING *
        `;
        return { statusCode: 201, body: JSON.stringify(newAccount) };
      }
      case 'DELETE': {
        await sql`DELETE FROM accounts WHERE id = ${body.id} AND user_id = ${discordId}`;
        return { statusCode: 200, body: JSON.stringify({ message: 'Conta deletada' }) };
      }
      default: return { statusCode: 405, body: 'Method Not Allowed' };
    }
  } catch (err) {
    return { statusCode: 500, body: 'Erro no servidor' };
  }
};
