import { Handler } from '@netlify/functions';
import { siteDbSql } from './lib/db.js';

// Conexão com o banco (Neon)
const sql = siteDbSql;

// Função para validar o token e pegar o ID do Discord
const getDiscordId = async (authHeader: string | null | undefined): Promise<string | null> => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];

    try {
        const res = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.id; // Retorna o ID do Discord como String
    } catch {
        return null;
    }
};

// Lógica de recorrência simplificada (sem Google)
const getNextDueDate = (currentDueDate: string | Date, recurrence: string): string => {
    const date = new Date(currentDueDate);
    const correctedDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);

    if (recurrence === 'Daily') correctedDate.setDate(correctedDate.getDate() + 1);
    else if (recurrence === 'Weekly') correctedDate.setDate(correctedDate.getDate() + 7);
    else if (recurrence === 'Monthly') correctedDate.setMonth(correctedDate.getMonth() + 1);

    return correctedDate.toISOString().split('T')[0];
};

export const handler: Handler = async (event) => {
    // Agora validamos via Discord!
    const discordId = await getDiscordId(event.headers.authorization);
    if (!discordId) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const method = event.httpMethod;
        const body = event.body ? JSON.parse(event.body) : {};

        switch (method) {
            case 'GET': {
                // Busca usando o novo user_id (String/Discord ID)
                const tasks = await sql`
          SELECT * FROM tasks 
          WHERE user_id = ${discordId} 
          ORDER BY due_date ASC, due_time ASC, created_at DESC
        `;
                return { statusCode: 200, body: JSON.stringify(tasks) };
            }

            case 'POST': {
                const [newTask] = await sql`
          INSERT INTO tasks (text, user_id, due_date, priority, recurrence, is_all_day, due_time) 
          VALUES (
            ${body.text}, 
            ${discordId}, 
            ${body.due_date || null}, 
            ${body.priority || 'Medium'}, 
            ${body.recurrence || 'None'}, 
            ${body.is_all_day}, 
            ${body.is_all_day ? null : body.due_time}
          ) 
          RETURNING *
        `;
                return { statusCode: 201, body: JSON.stringify(newTask) };
            }

            case 'PUT': {
                const [existingTask] = await sql`SELECT * FROM tasks WHERE id = ${body.id} AND user_id = ${discordId}`;
                if (!existingTask) return { statusCode: 404, body: JSON.stringify({ error: 'Task not found.' }) };

                let newRecurringTask = null;
                // Se a tarefa foi concluída e tem recorrência, cria a próxima
                if (body.completed && !existingTask.completed && existingTask.recurrence !== 'None' && existingTask.due_date) {
                    const nextDate = getNextDueDate(existingTask.due_date as string | Date, String(existingTask.recurrence));
                    [newRecurringTask] = await sql`
                INSERT INTO tasks (text, user_id, due_date, priority, recurrence, is_all_day, due_time)
                VALUES (${existingTask.text}, ${discordId}, ${nextDate}, ${existingTask.priority}, ${existingTask.recurrence}, ${existingTask.is_all_day}, ${existingTask.due_time})
                RETURNING *
            `;
                }

                const [updatedTask] = await sql`
            UPDATE tasks 
            SET 
                text = ${body.text ?? existingTask.text},
                completed = ${body.completed ?? existingTask.completed},
                due_date = ${body.due_date ?? existingTask.due_date},
                priority = ${body.priority ?? existingTask.priority},
                recurrence = ${body.recurrence ?? existingTask.recurrence},
                is_all_day = ${body.is_all_day ?? existingTask.is_all_day},
                due_time = ${body.is_all_day ? null : (body.due_time ?? existingTask.due_time)}
            WHERE id = ${body.id} AND user_id = ${discordId}
            RETURNING *
        `;

                return { statusCode: 200, body: JSON.stringify({ updatedTask, newRecurringTask }) };
            }

            case 'DELETE': {
                // O body do DELETE costuma vir como { id: 123 }
                const { id } = body;
                await sql`DELETE FROM tasks WHERE id = ${id} AND user_id = ${discordId}`;
                return { statusCode: 200, body: JSON.stringify({ message: 'Task deleted successfully.' }) };
            }

            default:
                return { statusCode: 405, body: 'Method Not Allowed' };
        }
    } catch (err) {
        console.error(err);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
