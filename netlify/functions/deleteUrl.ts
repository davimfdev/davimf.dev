import { Config, Context } from '@netlify/functions';
import { siteDbSql } from './lib/db.js';

export default async (req: Request, context: Context) => {
    // 1. Bloqueia se não for DELETE
    if (req.method !== 'DELETE') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.split(' ')[1];
        const body = await req.json();
        const urlId = body.id;

        if (!token || !urlId) {
            return new Response(JSON.stringify({ error: 'Token ou ID ausente.' }), { status: 401 });
        }

        // 2. Valida o usuário no Discord
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!userRes.ok) {
            return new Response(JSON.stringify({ error: 'Sessão expirada.' }), { status: 401 });
        }

        const user = await userRes.json();
        const discordId = user.id;

        // 3. Conecta no Neon e deleta
        const sql = siteDbSql;
        const result = await sql`
        DELETE FROM urls 
        WHERE id = ${urlId} AND user_id = ${discordId}
        RETURNING id
    `;

        if (result.length === 0) {
            return new Response(JSON.stringify({ error: 'Permissão negada ou link inexistente.' }), { status: 404 });
        }

        return new Response(JSON.stringify({ message: 'Link removido!' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('Erro ao deletar URL:', err.message);
        return new Response(JSON.stringify({ error: 'Erro interno no servidor.' }), { status: 500 });
    }
};

// Define a rota exata para o frontend não dar 404
export const config: Config = {
    path: "/api/deleteurl",
};