import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { siteDbSql } from './lib/db.js';

// The Handler type is important for type-checking and auto-completion
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Ensure we only handle POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // Initialize Neon connection
  const sql = siteDbSql;

  try {
    const body = JSON.parse(event.body || "{}");
    const originalUrl = body.url;

    if (!originalUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "URL is required" }),
      };
    }

    // Generate a short, random code
    const generateShortCode = (length = 6) => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const shortCode = generateShortCode();

    // Note: In a high-traffic application, you'd want to check if the code
    // already exists and regenerate if it does. For this example, we'll
    // assume collisions are rare.

    // Save to the database
    await sql`INSERT INTO urls (id, original_url) VALUES (${shortCode}, ${originalUrl})`;

    // Return the new short URL
    const shortUrl = `${process.env.URL || 'http://localhost:8888'}/r/${shortCode}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ shortUrl }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

export { handler };
