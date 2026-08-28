import { Config, Context } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { authDbSql } from './lib/db.js';

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

  const sql = authDbSql;

  try {
    switch (req.method) {
      case 'GET': {
        const expenses = await sql`
          SELECT e.id, e.description, e.amount, e.category, e.date, e.payment_type, a.name as account_name
          FROM expenses e
          JOIN accounts a ON e.account_id = a.id
          WHERE e.user_id = ${userId} 
          ORDER BY e.date DESC, e.created_at DESC
        `;
        return new Response(JSON.stringify(expenses), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'POST': {
        const { description, amount, category, date, account_id, payment_type } = await req.json();
        if (!description || !amount || !category || !date || !account_id || !payment_type) {
          return new Response(JSON.stringify({ error: 'All fields are required.' }), { status: 400 });
        }
        const result = await sql`
          INSERT INTO expenses (description, amount, category, date, user_id, account_id, payment_type) 
          VALUES (${description}, ${amount}, ${category}, ${date}, ${userId}, ${account_id}, ${payment_type}) 
          RETURNING id, description, amount, category, date, payment_type
        `;
        return new Response(JSON.stringify(result[0]), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'DELETE': {
        const { id } = await req.json();
        if (id === undefined) {
          return new Response(JSON.stringify({ error: 'Expense ID is required.' }), { status: 400 });
        }
        const result = await sql`
          DELETE FROM expenses 
          WHERE id = ${id} AND user_id = ${userId} 
          RETURNING id
        `;
        if (result.length === 0) {
          return new Response(JSON.stringify({ error: 'Expense not found or permission denied.' }), { status: 404 });
        }
        return new Response(JSON.stringify({ message: 'Expense deleted successfully.' }), { status: 200 });
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
  path: "/api/expenses",
};
