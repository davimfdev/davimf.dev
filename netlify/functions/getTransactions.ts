import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export const handler: Handler = async (event) => {
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) return { statusCode: 401, body: 'Unauthorized' };

    try {
        const discordIdRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!discordIdRes.ok) return { statusCode: 401, body: 'Invalid Token' };
        const userData = await discordIdRes.json();
        const discordId = userData.id;

        const method = event.httpMethod;
        const body = event.body ? JSON.parse(event.body) : {};

        switch (method) {
            case 'GET':
                const transactions = await sql`
                    SELECT t.*, a.name as account_name 
                    FROM transactions t
                    JOIN accounts a ON t.account_id = a.id
                    WHERE t.user_id = ${discordId}
                    ORDER BY t.date DESC, t.created_at DESC
                `;
                return { statusCode: 200, body: JSON.stringify(transactions) };

            case 'POST':
                // Se for transferência, cria dois registros
                if (body.type === 'transfer') {
                    const { fromAccountId, toAccountId, amount, description } = body;
                    await sql`INSERT INTO transactions (user_id, account_id, description, amount, category, payment_type, is_paid, date)
                              VALUES (${discordId}, ${fromAccountId}, ${description || 'Transferência Enviada'}, ${-Math.abs(amount)}, 'Transferência', 'PIX', true, now())`;
                    await sql`INSERT INTO transactions (user_id, account_id, description, amount, category, payment_type, is_paid, date)
                              VALUES (${discordId}, ${toAccountId}, ${description || 'Transferência Recebida'}, ${Math.abs(amount)}, 'Transferência', 'PIX', true, now())`;
                    return { statusCode: 201, body: JSON.stringify({ message: 'Transferência ok' }) };
                }

                // Transação normal - GARANTA QUE NÃO ESTÁ TENTANDO INSERIR NA TABELA ACCOUNTS AQUI
                const [newTransaction] = await sql`
                    INSERT INTO transactions (user_id, account_id, description, amount, category, payment_type, is_paid, date)
                    VALUES (${discordId}, ${body.account_id}, ${body.description}, ${body.amount}, ${body.category}, 'PIX', true, ${body.date || 'now()'})
                    RETURNING *
                `;
                return { statusCode: 201, body: JSON.stringify(newTransaction) };

            case 'DELETE':
                await sql`DELETE FROM transactions WHERE id = ${body.id} AND user_id = ${discordId}`;
                return { statusCode: 200, body: JSON.stringify({ message: 'Removido' }) };

            default:
                return { statusCode: 405, body: 'Method Not Allowed' };
        }
    } catch (err: any) {
        console.error(err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};