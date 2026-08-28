import { Context } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import cookie from 'cookie';
import { authDbSql } from './lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET!;
const sql = authDbSql;

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const cookies = cookie.parse(req.headers.get('Cookie') || '');
  const refreshToken = cookies.refresh_token;

  if (!refreshToken) {
    return new Response(JSON.stringify({ error: 'Refresh token not found.' }), { status: 401 });
  }

  try {
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    
    const tokenResult = await sql`
      SELECT * FROM refresh_tokens WHERE token_hash = ${refreshTokenHash} AND expires_at > NOW()
    `;

    if (tokenResult.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or expired refresh token.' }), { status: 403 });
    }

    const tokenRecord = tokenResult[0];
    const userResult = await sql`SELECT * FROM users WHERE id = ${tokenRecord.user_id}`;
    if (userResult.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found.' }), { status: 403 });
    }
    const user = userResult[0];

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, jti: randomBytes(16).toString('hex') },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    return new Response(JSON.stringify({ accessToken }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Refresh API Error:', err);
    return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), { status: 500 });
  }
};
