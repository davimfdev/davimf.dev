import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';

export default async (req: Request, context: Context) => {
  // Extract the short code from the query parameters, e.g., /api/get-url?code=abcdef
  const url = new URL(req.url);
  const shortCode = url.searchParams.get('code');

  if (!shortCode) {
    return new Response(JSON.stringify({ error: 'Short code is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    const result = await sql`SELECT original_url FROM urls WHERE id = ${shortCode}`;

    if (result.length > 0) {
      const originalUrl = result[0].original_url;
      return new Response(JSON.stringify({ originalUrl }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'URL not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = {
  path: "/api/get-url",
};
