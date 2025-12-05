import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';
import jwt from 'jsonwebtoken';

interface UserPayload {
  userId: number;
  email: string;
}

// Helper para extrair o ID do usuário do token
const getUserIdFromToken = (req: Request): number | null => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    return decoded.userId;
  } catch (error) {
    console.error('Invalid token', error);
    return null;
  }
};

export default async (req: Request, context: Context) => {
  const userId = getUserIdFromToken(req);

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL!);

  try {
    switch (req.method) {
      // LER todas as tarefas do usuário
      case 'GET': {
        const tasks = await sql`SELECT id, text, completed FROM tasks WHERE user_id = ${userId} ORDER BY created_at DESC`;
        return new Response(JSON.stringify(tasks), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // CRIAR uma nova tarefa
      case 'POST': {
        const { text } = await req.json();
        if (!text) {
          return new Response(JSON.stringify({ error: 'Task text is required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const result = await sql`INSERT INTO tasks (text, user_id) VALUES (${text}, ${userId}) RETURNING id, text, completed`;
        return new Response(JSON.stringify(result[0]), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ATUALIZAR uma tarefa (marcar como completa/incompleta)
      case 'PUT': {
        const { id, completed } = await req.json();
        if (id === undefined || typeof completed !== 'boolean') {
          return new Response(JSON.stringify({ error: 'Task ID and completed status are required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const result = await sql`UPDATE tasks SET completed = ${completed} WHERE id = ${id} AND user_id = ${userId} RETURNING id, text, completed`;
        if (result.length === 0) {
          return new Response(JSON.stringify({ error: 'Task not found or permission denied.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify(result[0]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // DELETAR uma tarefa
      case 'DELETE': {
        const { id } = await req.json();
        if (id === undefined) {
          return new Response(JSON.stringify({ error: 'Task ID is required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const result = await sql`DELETE FROM tasks WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
        if (result.length === 0) {
          return new Response(JSON.stringify({ error: 'Task not found or permission denied.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ message: 'Task deleted successfully.' }), { status: 200 });
      }

      default:
        return new Response('Method Not Allowed', { status: 405 });
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = {
  path: "/api/tasks",
};
