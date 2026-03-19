import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const shortCode = url.searchParams.get('code');

  if (!shortCode) {
    return new Response(JSON.stringify({ error: 'Código (shortCode) é obrigatório.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // AJUSTE: Usando DATABASE_URL que é o padrão que configuramos no Neon
    const sql = neon(process.env.DATABASE_URL!);

    // AJUSTE: Buscando por short_code (o texto) e não pelo id (o número)
    const result = await sql`SELECT original_url FROM urls WHERE short_code = ${shortCode} LIMIT 1`;

    if (result.length > 0) {
      return new Response(JSON.stringify({ originalUrl: result[0].original_url }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Link não encontrado no banco de dados.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    console.error('Erro no redirecionamento:', err.message);
    return new Response(JSON.stringify({ error: 'Erro interno no servidor.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = {
  path: "/api/get-url",
};