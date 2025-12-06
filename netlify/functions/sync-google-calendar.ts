import { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { getGoogleAuthClient, fetchInitialGoogleData } from './google-calendar-helpers';

// **CORREÇÃO APLICADA AQUI:** Usando NETLIFY_DATABASE_URL
const sql = neon(process.env.NETLIFY_DATABASE_URL!);

interface UserPayload {
  userId: number;
}

const getUserIdFromToken = (req: Request): number | null => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
    return payload.userId;
  } catch (error) {
    return null;
  }
};

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const userId = getUserIdFromToken(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const auth = await getGoogleAuthClient(userId);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Google Calendar not connected for this user.' }), { status: 400 });
    }

    const googleItems = await fetchInitialGoogleData(auth);
    const googleItemIds = new Set(googleItems.map(item => item.google_event_id));

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

    const localGoogleTasks = await sql`
      SELECT google_event_id FROM tasks 
      WHERE user_id = ${userId} AND google_event_id IS NOT NULL AND completed = false
    `;

    const tasksToDelete = localGoogleTasks
      .map(task => task.google_event_id)
      .filter(localId => !googleItemIds.has(localId));

    if (tasksToDelete.length > 0) {
      await sql`
        DELETE FROM tasks 
        WHERE user_id = ${userId} AND google_event_id IN (${tasksToDelete.join(',')})
      `;
    }

    return new Response(JSON.stringify({ message: `Sync completed. Found ${googleItems.length} items, deleted ${tasksToDelete.length} stale tasks.` }), { status: 200 });

  } catch (error) {
    console.error('Error during manual Google Calendar sync:', error);
    return new Response(JSON.stringify({ error: 'An internal server error occurred during sync.' }), { status: 500 });
  }
};
