import { Handler } from '@netlify/functions';
import { siteDbSql } from './lib/db.js';

const sql = siteDbSql;

export const handler: Handler = async (event) => {
    const authHeader = event.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Token não fornecido.' }) };
    }

    try {
        // 1. Valida o usuário no Discord para pegar o ID real
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!userRes.ok) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Sessão do Discord expirada.' }) };
        }

        const user = await userRes.json();
        const discordId = user.id;

        // 2. Busca no Neon as URLs vinculadas a este Discord ID
        // Note: 'user_id' no banco deve ser VARCHAR para aceitar o ID do Discord
        const urls = await sql`
            SELECT * FROM urls 
            WHERE user_id = ${discordId} 
            ORDER BY created_at DESC
        `;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(urls || [])
        };

    } catch (err: any) {
        console.error('Erro ao buscar URLs:', err.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erro interno ao buscar histórico.' })
        };
    }
};