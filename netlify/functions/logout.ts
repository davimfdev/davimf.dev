import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { createHash } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET!;
const sql = neon(process.env.NETLIFY_DATABASE_URL!);

interface AccessTokenPayload {
  userId: number;
  jti: string;
  exp: number;
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  const cookies = cookie.parse(req.headers.get('Cookie') || '');
  const refreshToken = cookies.refresh_token;

  try {
    // 1. Blacklist the access token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.split(' ')[1];
      try {
        const payload = jwt.verify(accessToken, JWT_SECRET, { ignoreExpiration: true }) as AccessTokenPayload;
        const expiresAt = new Date(payload.exp * 1000);
        // Add the unique token identifier (jti) to the blacklist
        await sql`INSERT INTO token_blacklist (jti, expires_at) VALUES (${payload.jti}, ${expiresAt.toISOString()})`;
      } catch (e) {
        // Ignore if the token is already invalid
      }
    }

    // 2. Invalidate the refresh token
    if (refreshToken) {
      const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
      await sql`DELETE FROM refresh_tokens WHERE token_hash = ${refreshTokenHash}`;
    }

    // 3. Clear the refresh token cookie
    const clearCookie = cookie.serialize('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      path: '/',
      sameSite: 'strict',
      expires: new Date(0), // Set to a past date
    });

    return new Response(JSON.stringify({ message: 'Logged out successfully.' }), {
      status: 200,
      headers: {
        'Set-Cookie': clearCookie,
        'Content-Type': 'application/json'
      },
    });

  } catch (err) {
    console.error('Logout API Error:', err);
    return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), { status: 500 });
  }
};

export const config: Config = {
  path: "/api/logout",
};
