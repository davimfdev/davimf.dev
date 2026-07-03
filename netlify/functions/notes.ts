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
  if (!discordId) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};

    switch (method) {
      case 'GET': {
        const notes = await sql`
          SELECT * FROM notes
          WHERE user_id = ${discordId}
          ORDER BY updated_at DESC
        `;
        return { statusCode: 200, body: JSON.stringify(notes) };
      }

      case 'POST': {
        const [note] = await sql`
          INSERT INTO notes (user_id, title, content, color, opacity, pos_x, pos_y, width, height, z_index)
          VALUES (
            ${discordId},
            ${body.title ?? 'Nova Nota'},
            ${body.content ?? ''},
            ${body.color ?? '#6366f1'},
            ${body.opacity ?? 0.85},
            ${body.pos_x ?? null},
            ${body.pos_y ?? null},
            ${body.width ?? 280},
            ${body.height ?? 200},
            ${body.z_index ?? 1}
          )
          RETURNING *
        `;
        return { statusCode: 201, body: JSON.stringify(note) };
      }

      case 'PUT': {
        const [existing] = await sql`SELECT * FROM notes WHERE id = ${body.id} AND user_id = ${discordId}`;
        if (!existing) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };

        const posX = 'pos_x' in body ? body.pos_x : existing.pos_x;
        const posY = 'pos_y' in body ? body.pos_y : existing.pos_y;

        const [updated] = await sql`
          UPDATE notes SET
            title        = COALESCE(${body.title ?? null}, title),
            content      = COALESCE(${body.content ?? null}, content),
            color        = COALESCE(${body.color ?? null}, color),
            opacity      = COALESCE(${body.opacity ?? null}, opacity),
            pos_x        = ${posX},
            pos_y        = ${posY},
            width        = COALESCE(${body.width ?? null}, width),
            height       = COALESCE(${body.height ?? null}, height),
            z_index      = COALESCE(${body.z_index ?? null}, z_index),
            is_minimized = COALESCE(${body.is_minimized ?? null}, is_minimized),
            is_pinned    = COALESCE(${body.is_pinned ?? null}, is_pinned),
            is_maximized = COALESCE(${body.is_maximized ?? null}, is_maximized),
            updated_at   = NOW()
          WHERE id = ${body.id} AND user_id = ${discordId}
          RETURNING *
        `;
        return { statusCode: 200, body: JSON.stringify(updated) };
      }

      case 'DELETE': {
        await sql`DELETE FROM notes WHERE id = ${body.id} AND user_id = ${discordId}`;
        return { statusCode: 200, body: JSON.stringify({ message: 'Deleted' }) };
      }

      default:
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
