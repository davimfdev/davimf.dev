import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set.');
    }

    // Find the user by email
    const users = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid credentials.' }), {
        status: 401, // 401 Unauthorized
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = users[0];

    // Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return new Response(JSON.stringify({ error: 'Invalid credentials.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If credentials are correct, create a JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1d' } // Token expires in 1 day
    );

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = {
  path: "/api/login",
};
