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
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const existingUserResult = await sql`SELECT id, password_hash FROM users WHERE email = ${email}`;

    if (existingUserResult.length > 0) {
      const existingUser = existingUserResult[0];
      // If the user exists but has no password, update their record
      if (!existingUser.password_hash) {
        await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${existingUser.id}`;
        return new Response(JSON.stringify({ message: 'Password set for existing user.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        // If user exists and has a password, return conflict
        return new Response(JSON.stringify({ error: 'User with this email already exists.' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // If user does not exist, create a new one
      await sql`INSERT INTO users (email, password_hash) VALUES (${email}, ${passwordHash})`;
      return new Response(JSON.stringify({ message: 'User registered successfully.' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (err) {
    console.error('Registration API Error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = {
  path: "/api/register",
};
