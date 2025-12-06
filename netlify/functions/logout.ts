import { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET!;
const sql = neon(process.env.NETLIFY_DATABASE_URL!);

interface UserPayload {
  jti: string;
  exp: number;
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
      const expiry = new Date(payload.exp * 1000);
      await sql`INSERT INTO token_blacklist (jti, expires_at) VALUES (${payload.jti}, ${expiry.toISOString()})`;
    } catch (error) {
      console.warn("Logout attempt with invalid token:", error);
    }
  }

  const clearCookie = cookie.serialize('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    path: '/',
    sameSite: 'strict',
    expires: new Date(0),
  });

  return new Response(JSON.stringify({ message: 'Logged out successfully.' }), {
    status: 200,
    headers: {
      'Set-Cookie': clearCookie,
      'Content-Type': 'application/json',
    },
  });
};
