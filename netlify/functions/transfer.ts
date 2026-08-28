import { Config, Context } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { authDbSql } from './lib/db.js';

interface UserPayload {
  userId: number;
  email: string;
  jti: string;
  exp: number;
}

const sql = authDbSql;

const getUserIdFromToken = async (req: Request): Promise<number | null> => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET!;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as UserPayload;

    const blacklisted = await sql`SELECT 1 FROM token_blacklist WHERE jti = ${payload.jti}`;
    if (blacklisted.length > 0) {
      console.warn('Attempted to use a blacklisted token.');
      return null;
    }

    return payload.userId;
  } catch (error) {
    console.error('Invalid token:', error);
    return null;
  }
};

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const userId = await getUserIdFromToken(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { fromAccountId, toAccountId, amount, date, description } = await req.json();

    if (!fromAccountId || !toAccountId || !amount || !date || !description) {
      return new Response(JSON.stringify({ error: 'All fields are required for a transfer.' }), { status: 400 });
    }

    if (fromAccountId === toAccountId) {
      return new Response(JSON.stringify({ error: 'Source and destination accounts cannot be the same.' }), { status: 400 });
    }

    const fromTransactionResult = await sql`
      INSERT INTO transactions (user_id, account_id, description, amount, category, date, is_paid) 
      VALUES (${userId}, ${fromAccountId}, ${description}, ${-Math.abs(amount)}, 'Transferência', ${date}, true)
      RETURNING *;
    `;

    const toTransactionResult = await sql`
      INSERT INTO transactions (user_id, account_id, description, amount, category, date, is_paid) 
      VALUES (${userId}, ${toAccountId}, ${description}, ${Math.abs(amount)}, 'Transferência', ${date}, true)
      RETURNING *;
    `;

    return new Response(JSON.stringify({ 
        message: 'Transfer completed successfully.',
        fromTransaction: fromTransactionResult[0],
        toTransaction: toTransactionResult[0]
    }), { status: 201 });

  } catch (err) {
    console.error('Transfer API Error:', err);
    return new Response(JSON.stringify({ error: 'An internal server error occurred during the transfer.' }), { status: 500 });
  }
};

export const config: Config = {
  path: "/api/transfer",
};
