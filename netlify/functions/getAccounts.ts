import { Handler } from '@netlify/functions';
import { siteDbSql } from './lib/db.js';

const sql = siteDbSql;

export const handler: Handler = async (event) => {
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) return { statusCode: 401, body: 'Unauthorized' };

    try {
        const discordIdRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!discordIdRes.ok) return { statusCode: 401, body: 'Invalid Discord Token' };

        const userData = await discordIdRes.json();
        const discordId = userData.id;

        switch (event.httpMethod) {
            case 'GET': {
                const accounts = await sql`SELECT * FROM accounts WHERE user_id = ${discordId} ORDER BY name ASC`;
                return { statusCode: 200, body: JSON.stringify(accounts) };
            }
            case 'POST': {
                const postBody = JSON.parse(event.body || '{}');
                const [newAccount] = await sql`
                    INSERT INTO accounts (user_id, name, currency, type, initial_balance)
                    VALUES (${discordId}, ${postBody.name}, 'BRL', 'Corrente', ${postBody.initial_balance || 0})
                    RETURNING *
                `;
                return { statusCode: 201, body: JSON.stringify(newAccount) };
            }
            case 'DELETE': {
                const deleteBody = JSON.parse(event.body || '{}');
                const { id } = deleteBody;

                if (!id) return { statusCode: 400, body: 'ID da conta é obrigatório' };

                await sql`DELETE FROM transactions WHERE account_id = ${id} AND user_id = ${discordId}`;
                await sql`DELETE FROM accounts WHERE id = ${id} AND user_id = ${discordId}`;

                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'Banco e transações removidos com sucesso' })
                };
            }
            default:
                return { statusCode: 405, body: 'Method Not Allowed' };
        }
    } catch (err: any) {
        console.error('Erro na API getAccounts:', err);
        return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno no servidor' }) };
    }
};