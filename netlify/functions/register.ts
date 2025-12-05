import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';

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

    // Check if user already exists
    const existingUser = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existingUser.length > 0) {
      return new Response(JSON.stringify({ error: 'User with this email already exists.' }), {
        status: 409, // 409 Conflict is a good status code for this
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Store the new user
    await sql`INSERT INTO users (email, password_hash) VALUES (${email}, ${passwordHash})`;

    return new Response(JSON.stringify({ message: 'User registered successfully.' }), {
      status: 201, // 201 Created
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
  path: "/api/register",
};
