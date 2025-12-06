import { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import cookie from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET!;
const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required.' }), { status: 400 });
    }

    const userResult = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
    if (userResult.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid credentials.' }), { status: 401 });
    }
    const user = userResult[0];

    if (!user.password_hash || typeof user.password_hash !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid credentials.' }), { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ error: 'Invalid credentials.' }), { status: 401 });
    }

    const googleIntegrationResult = await sql`
      SELECT 1 FROM google_calendar_integrations WHERE user_id = ${user.id}
    `;
    const isGoogleConnected = googleIntegrationResult.length > 0;

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, jti: randomBytes(16).toString('hex'), isGoogleConnected },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = randomBytes(64).toString('hex');
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    await sql`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
      VALUES (${user.id}, ${refreshTokenHash}, ${refreshTokenExpiry.toISOString()})
    `;

    const refreshTokenCookie = cookie.serialize('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      path: '/',
      sameSite: 'strict',
      expires: refreshTokenExpiry,
    });

    const responseBody = JSON.stringify({ accessToken, isGoogleConnected });
    return new Response(responseBody, {
      status: 200,
      headers: { 
        'Set-Cookie': refreshTokenCookie,
        'Content-Type': 'application/json'
      },
    });

  } catch (err) {
    console.error('Login API Error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 500 });
  }
};
