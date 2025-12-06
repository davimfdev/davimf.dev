import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { getGoogleAuthClient, fetchInitialGoogleData } from './google-calendar-helpers';

const sql = neon(process.env.DATABASE_URL!);

interface UserPayload {
  userId: number;
}

const getUserIdFromToken = (authHeader: string | null): number | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
    return payload.userId;
  } catch (error) {
    return null;
  }
};

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const userId = getUserIdFromToken(event.headers.authorization);
  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const auth = await getGoogleAuthClient(userId);
    if (!auth) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Google Calendar not connected for this user.' }) };
    }

    // 1. Buscar todos os itens futuros do Google
    const googleItems = await fetchInitialGoogleData(auth);
    const googleItemIds = new Set(googleItems.map(item => item.google_event_id));

    // 2. Inserir/Atualizar os itens do Google no nosso DB
    if (googleItems.length > 0) {
      const tasksToInsert = googleItems.map(task => ({ ...task, user_id: userId }));
      await sql`
          INSERT INTO tasks (text, completed, due_date, priority, recurrence, is_all_day, due_time, google_event_id, user_id)
          SELECT text, completed, due_date::date, priority, recurrence, is_all_day, due_time::time, google_event_id, user_id
          FROM json_populate_recordset(null::tasks, ${JSON.stringify(tasksToInsert)})
          ON CONFLICT (google_event_id) DO UPDATE SET
            text = EXCLUDED.text,
            due_date = EXCLUDED.due_date,
            due_time = EXCLUDED.due_time,
            is_all_day = EXCLUDED.is_all_day;
      `;
    }

    // 3. Buscar IDs locais que deveriam estar no Google
    const localGoogleTasks = await sql`
      SELECT google_event_id FROM tasks 
      WHERE user_id = ${userId} AND google_event_id IS NOT NULL AND completed = false
    `;

    // 4. Encontrar e deletar tarefas que foram removidas no Google
    const tasksToDelete = localGoogleTasks
      .map(task => task.google_event_id)
      .filter(localId => !googleItemIds.has(localId));

    if (tasksToDelete.length > 0) {
      console.log(`Deletando ${tasksToDelete.length} tarefas locais que foram removidas no Google.`);
      await sql`
        DELETE FROM tasks 
        WHERE user_id = ${userId} AND google_event_id IN (${tasksToDelete.join(',')})
      `;
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify({ message: `Sync completed. Found ${googleItems.length} items, deleted ${tasksToDelete.length} stale tasks.` })
    };

  } catch (error) {
    console.error('Error during manual Google Calendar sync:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'An internal server error occurred during sync.' })
    };
  }
};
