import { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

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

    const existingUser = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existingUser.length > 0) {
      return new Response(JSON.stringify({ error: 'User with this email already exists.' }), { status: 409 });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await sql`
      INSERT INTO users (email, password_hash) 
      VALUES (${email}, ${passwordHash})
    `;

    return new Response(JSON.stringify({ message: 'User registered successfully.' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Registration API Error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 500 });
  }
};
