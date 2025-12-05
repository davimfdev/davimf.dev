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
    return (jwt.verify(token, JWT_SECRET) as UserPayload).userId;
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
      // LISTAR todas as transações do usuário
      case 'GET': {
        const transactions = await sql`
          SELECT t.id, t.description, t.amount, t.category, t.date, t.account_id, a.name as account_name
          FROM transactions t
          JOIN accounts a ON t.account_id = a.id
          WHERE t.user_id = ${userId} 
          ORDER BY t.date DESC, t.created_at DESC
        `;
        return new Response(JSON.stringify(transactions), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // CRIAR uma nova transação
      case 'POST': {
        const { description, amount, category, date, account_id } = await req.json();
        if (!description || amount === undefined || !category || !date || !account_id) {
          return new Response(JSON.stringify({ error: 'All fields are required.' }), { status: 400 });
        }
        const result = await sql`
          INSERT INTO transactions (description, amount, category, date, user_id, account_id) 
          VALUES (${description}, ${amount}, ${category}, ${date}, ${userId}, ${account_id}) 
          RETURNING id, description, amount, category, date, account_id
        `;
        return new Response(JSON.stringify(result[0]), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // DELETAR uma transação
      case 'DELETE': {
        const { id } = await req.json();
        if (id === undefined) {
          return new Response(JSON.stringify({ error: 'Transaction ID is required.' }), { status: 400 });
        }
        const result = await sql`
          DELETE FROM transactions 
          WHERE id = ${id} AND user_id = ${userId} 
          RETURNING id
        `;
        if (result.length === 0) {
          return new Response(JSON.stringify({ error: 'Transaction not found or permission denied.' }), { status: 404 });
        }
        return new Response(JSON.stringify({ message: 'Transaction deleted successfully.' }), { status: 200 });
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
  path: "/api/transactions",
};
