import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return new Response(JSON.stringify({ error: 'Token and new password are required.' }), { status: 400 });
    }

    const resetTokenHash = createHash('sha256').update(token).digest('hex');

    const userResult = await sql`
      SELECT id FROM users 
      WHERE reset_token_hash = ${resetTokenHash} AND reset_token_expires_at > NOW()
    `;

    if (userResult.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or expired password reset token.' }), { status: 400 });
    }
    const user = userResult[0];

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await sql`
      UPDATE users 
      SET 
        password_hash = ${passwordHash},
        reset_token_hash = NULL,
        reset_token_expires_at = NULL
      WHERE id = ${user.id}
    `;

    return new Response(JSON.stringify({ message: 'Password has been reset successfully.' }), { status: 200 });

  } catch (err) {
    console.error('Reset Password Error:', err);
    return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), { status: 500 });
  }
};

export const config: Config = {
  path: "/api/reset-password",
};
