import { Config, Context } from '@netlify/functions';
import jwt from 'jsonwebtoken';

const getUserIdFromToken = (req: Request): number | null => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) return null;

  try {
    return (jwt.verify(token, JWT_SECRET) as any).userId;
  } catch (error) {
    return null;
  }
};

export default async (req: Request, context: Context) => {
  const userId = getUserIdFromToken(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const API_KEY = process.env.EXCHANGERATE_API_KEY;
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'Exchange rate API key is not configured.' }), { status: 500 });
  }

  // Usaremos USD como base, pois é uma prática comum e robusta.
  const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates from external API.');
    }
    const data = await response.json();

    if (data.result === 'error') {
        throw new Error(`External API error: ${data['error-type']}`);
    }

    // Repassamos apenas as taxas de conversão para o frontend
    return new Response(JSON.stringify(data.conversion_rates), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'An internal error occurred while fetching exchange rates.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = {
  path: "/api/exchange-rates",
};
