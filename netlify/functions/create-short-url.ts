import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const authHeader = event.headers.authorization;
  const token = authHeader?.split(' ')[1];

  let discordId = null;
  if (token) {
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (userRes.ok) {
      const user = await userRes.json();
      discordId = user.id;
    }
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const originalUrl = body.originalUrl || body.original_url;

    if (!originalUrl) {
      return { statusCode: 400, body: JSON.stringify({ error: 'URL original é obrigatória' }) };
    }

    // Gera um código de 6 letras/números
    const shortCode = Math.random().toString(36).substring(2, 8);

    // Monta o link final (Se tiver rodando local, usa localhost, senão usa seu domínio)
    const host = event.headers.host || 'davimf.dev';
    const protocol = host.includes('localhost') ? 'http://' : 'https://';
    // Altere para incluir o /r/ antes do código
    const finalShortUrl = `${protocol}${host}/r/${shortCode}`;

    // Salva no banco (Certifique-se que sua tabela tem a coluna short_code)
    const [newUrl] = await sql`
            INSERT INTO urls (original_url, short_url, short_code, user_id, created_at)
            VALUES (${originalUrl}, ${finalShortUrl}, ${shortCode}, ${discordId}, now())
            RETURNING *
        `;

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newUrl.id,
        original_url: newUrl.original_url,
        short_url: newUrl.short_url,
        shortUrl: newUrl.short_url // Mandando duplicado pra não ter erro no front
      })
    };
  } catch (err: any) {
    console.error('Erro ao criar URL:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao gerar o link curto.' }) };
  }
};