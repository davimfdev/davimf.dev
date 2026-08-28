import { Config, Context } from '@netlify/functions';
import { randomBytes, createHash } from 'crypto';
import { authDbSql } from './lib/db.js';
// import { Resend } from 'resend'; // Email sending is disabled for now

const sql = authDbSql;
// const resend = new Resend(process.env.RESEND_API_KEY!);

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required.' }), { status: 400 });
    }

    const userResult = await sql`SELECT id FROM users WHERE email = ${email}`;
    
    if (userResult.length > 0) {
        const user = userResult[0];

        const resetToken = randomBytes(32).toString('hex');
        const resetTokenHash = createHash('sha256').update(resetToken).digest('hex');
        
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

        await sql`
          UPDATE users 
          SET reset_token_hash = ${resetTokenHash}, reset_token_expires_at = ${expiresAt.toISOString()}
          WHERE id = ${user.id}
        `;

        // --- Email sending logic remains here, commented out, ready for activation ---
        // const resetLink = `${new URL(req.url).origin}/reset-password?token=${resetToken}`;
        // await resend.emails.send({ from: '...', to: email, subject: '...', html: '...' });
    }

    // Always return a generic success message to prevent email enumeration attacks.
    // The reset link/token is NEVER returned in the response in this secure version.
    return new Response(JSON.stringify({ 
        message: 'If an account with that email exists, a password reset process has been initiated.'
    }), { status: 200 });

  } catch (err) {
    console.error('Request Password Reset Error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 500 });
  }
};

export const config: Config = {
  path: "/api/request-password-reset",
};
