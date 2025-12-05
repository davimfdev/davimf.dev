import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';
import jwt from 'jsonwebtoken';

interface UserPayload {
  userId: number;
}

const getUserIdFromToken = (req: Request): number | null => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
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
      // LISTAR todas as contas do usuário
      case 'GET': {
        const accounts = await sql`
          SELECT id, name, currency, type, initial_balance 
          FROM accounts 
          WHERE user_id = ${userId} 
          ORDER BY name
        `;
        return new Response(JSON.stringify(accounts), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // CRIAR uma nova conta
      case 'POST': {
        const { name, currency, type, initial_balance } = await req.json();
        if (!name || !currency || !type) {
          return new Response(JSON.stringify({ error: 'Name, currency, and type are required.' }), { status: 400 });
        }
        const result = await sql`
          INSERT INTO accounts (user_id, name, currency, type, initial_balance) 
          VALUES (${userId}, ${name}, ${currency}, ${type}, ${initial_balance || 0}) 
          RETURNING id, name, currency, type, initial_balance
        `;
        return new Response(JSON.stringify(result[0]), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // DELETAR uma conta
      case 'DELETE': {
        const { id } = await req.json();
        if (id === undefined) {
          return new Response(JSON.stringify({ error: 'Account ID is required.' }), { status: 400 });
        }
        // O ON DELETE CASCADE na tabela transactions cuidará das transações associadas
        const result = await sql`
          DELETE FROM accounts 
          WHERE id = ${id} AND user_id = ${userId} 
          RETURNING id
        `;
        if (result.length === 0) {
          return new Response(JSON.stringify({ error: 'Account not found or permission denied.' }), { status: 404 });
        }
        return new Response(JSON.stringify({ message: 'Account deleted successfully.' }), { status: 200 });
      }

      default:
        return new Response('Method Not Allowed', { status: 405 });
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = {
  path: "/api/accounts",
};
