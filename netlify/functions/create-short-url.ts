import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';

// Helper function to generate a short code
const generateShortCode = (length = 6) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default async (req: Request, context: Context) => {
  // Ensure we're only accepting POST requests
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { originalUrl } = await req.json();

    if (!originalUrl) {
      return new Response(JSON.stringify({ error: 'Original URL is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);

    // A simple retry mechanism to handle potential collisions
    let shortCode = generateShortCode();
    let existing = await sql`SELECT id FROM urls WHERE id = ${shortCode}`;
    let retries = 0;
    while (existing.length > 0 && retries < 5) {
      shortCode = generateShortCode();
      existing = await sql`SELECT id FROM urls WHERE id = ${shortCode}`;
      retries++;
    }

    if (existing.length > 0) {
      return new Response(JSON.stringify({ error: 'Could not generate a unique short URL. Please try again.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await sql`INSERT INTO urls (id, original_url) VALUES (${shortCode}, ${originalUrl})`;

    // Get the site's base URL from the request headers
    const siteUrl = new URL(req.url).origin;
    const newShortUrl = `${siteUrl}/r/${shortCode}`;

    return new Response(JSON.stringify({ shortUrl: newShortUrl }), {
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
  path: "/api/create-short-url",
};
