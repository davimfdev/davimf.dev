import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { getGoogleAuthClient, formatTaskAsGoogleEvent } from './google-calendar-helpers';
import { google } from 'googleapis';

interface UserPayload {
  userId: number;
}

const sql = neon(process.env.DATABASE_URL!);

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

const getNextDueDate = (currentDueDate: string, recurrence: 'Daily' | 'Weekly' | 'Monthly'): string => {
    const date = new Date(currentDueDate);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    if (recurrence === 'Daily') correctedDate.setDate(correctedDate.getDate() + 1);
    else if (recurrence === 'Weekly') correctedDate.setDate(correctedDate.getDate() + 7);
    else if (recurrence === 'Monthly') correctedDate.setMonth(correctedDate.getMonth() + 1);
    return correctedDate.toISOString().split('T')[0];
};

const syncTaskWithGoogle = async (userId: number, task: any) => {
  const auth = await getGoogleAuthClient(userId);
  if (!auth) return null;

  const event = formatTaskAsGoogleEvent(task);
  if (!event) return null;

  const calendar = google.calendar({ version: 'v3', auth });
  const googleId = task.google_event_id?.replace('google_', '');

  try {
    if (googleId) {
      const updatedEvent = await calendar.events.update({ calendarId: 'primary', eventId: googleId, requestBody: event });
      return `google_${updatedEvent.data.id}`;
    } else {
      const createdEvent = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
      return `google_${createdEvent.data.id}`;
    }
  } catch (error: any) {
    console.error(`Erro ao sincronizar evento do Google para o usuário ${userId}:`, error.message);
    return null;
  }
};

const completeGoogleItem = async (userId: number, task: any) => {
    const auth = await getGoogleAuthClient(userId);
    if (!auth || !task.google_event_id) return;

    const googleId = task.google_event_id.replace('google_', '');

    try {
        const calendar = google.calendar({ version: 'v3', auth });
        const event = await calendar.events.get({ calendarId: 'primary', eventId: googleId });
        if (event.data.summary?.startsWith('[Concluído]')) return;
        const updatedEvent = { ...event.data, summary: `[Concluído] ${task.text}` };
        await calendar.events.update({ calendarId: 'primary', eventId: googleId, requestBody: updatedEvent });
        return;
    } catch (error: any) {
        if (error.code !== 404) console.error(`Erro ao tentar completar item como Evento:`, error.message);
    }

    try {
        const tasksApi = google.tasks({ version: 'v1', auth });
        const taskLists = await tasksApi.tasklists.list();
        if (!taskLists.data.items) return;
        for (const taskList of taskLists.data.items) {
            try {
                await tasksApi.tasks.patch({ tasklist: taskList.id!, task: googleId, requestBody: { id: googleId, status: 'completed' } });
                return;
            } catch (taskError: any) {
                if (taskError.code !== 404) throw taskError;
            }
        }
    } catch (error) {
        console.error(`Erro ao tentar completar item como Tarefa:`, error);
    }
};

const deleteGoogleItem = async (userId: number, googleEventId: string) => {
    const auth = await getGoogleAuthClient(userId);
    if (!auth || !googleEventId) return;

    const googleId = googleEventId.replace('google_', '');

    try {
        const calendar = google.calendar({ version: 'v3', auth });
        await calendar.events.delete({ calendarId: 'primary', eventId: googleId });
        console.log(`Evento ${googleId} deletado do Google Calendar.`);
        return;
    } catch (error: any) {
        if (error.code !== 404) console.error(`Falha ao deletar evento do Google:`, error.message);
    }

    try {
        const tasksApi = google.tasks({ version: 'v1', auth });
        const taskLists = await tasksApi.tasklists.list();
        if (!taskLists.data.items) return;
        for (const taskList of taskLists.data.items) {
            try {
                await tasksApi.tasks.delete({ tasklist: taskList.id!, task: googleId });
                console.log(`Tarefa ${googleId} deletada da lista ${taskList.id}.`);
                return;
            } catch (taskError: any) {
                if (taskError.code !== 404) throw taskError;
            }
        }
    } catch (error) {
        console.error(`Falha ao deletar tarefa do Google:`, error);
    }
};

export const handler: Handler = async (event, context) => {
  const userId = getUserIdFromToken(event.headers.authorization);
  if (!userId) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    if (!event.body && event.httpMethod !== 'GET') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request body is missing.' }) };
    }

    switch (event.httpMethod) {
      case 'GET': {
        const tasks = await sql`SELECT * FROM tasks WHERE user_id = ${userId} ORDER BY due_date ASC, due_time ASC, created_at DESC`;
        return { statusCode: 200, body: JSON.stringify(tasks), headers: {'Content-Type': 'application/json'} };
      }

      case 'POST': {
        const taskData = JSON.parse(event.body!);
        const [newTask] = await sql`
          INSERT INTO tasks (text, user_id, due_date, priority, recurrence, is_all_day, due_time) 
          VALUES (${taskData.text}, ${userId}, ${taskData.due_date || null}, ${taskData.priority || 'Medium'}, ${taskData.recurrence || 'None'}, ${taskData.is_all_day}, ${taskData.is_all_day ? null : taskData.due_time}) 
          RETURNING *
        `;
        const googleEventId = await syncTaskWithGoogle(userId, newTask);
        if (googleEventId) {
          const [finalTask] = await sql`UPDATE tasks SET google_event_id = ${googleEventId} WHERE id = ${newTask.id} RETURNING *`;
          return { statusCode: 201, body: JSON.stringify(finalTask) };
        }
        return { statusCode: 201, body: JSON.stringify(newTask) };
      }

      case 'PUT': {
        const taskData = JSON.parse(event.body!);
        const [existingTask] = await sql`SELECT * FROM tasks WHERE id = ${taskData.id} AND user_id = ${userId}`;
        if (!existingTask) return { statusCode: 404, body: JSON.stringify({ error: 'Task not found.' }) };

        if (taskData.completed && !existingTask.completed) {
            await completeGoogleItem(userId, existingTask);
        }

        let newRecurringTask = null;
        if (taskData.completed && !existingTask.completed && existingTask.recurrence !== 'None' && existingTask.due_date) {
            const nextDate = getNextDueDate(existingTask.due_date, existingTask.recurrence);
            [newRecurringTask] = await sql`
                INSERT INTO tasks (text, user_id, due_date, priority, recurrence, is_all_day, due_time)
                VALUES (${existingTask.text}, ${userId}, ${nextDate}, ${existingTask.priority}, ${existingTask.recurrence}, ${existingTask.is_all_day}, ${existingTask.due_time})
                RETURNING *
            `;
            const googleEventId = await syncTaskWithGoogle(userId, newRecurringTask);
            if (googleEventId && newRecurringTask) {
                await sql`UPDATE tasks SET google_event_id = ${googleEventId} WHERE id = ${newRecurringTask.id}`;
                newRecurringTask.google_event_id = googleEventId;
            }
        }
        
        const [updatedTask] = await sql`
            UPDATE tasks 
            SET 
                text = ${taskData.text !== undefined ? taskData.text : existingTask.text},
                completed = ${taskData.completed !== undefined ? taskData.completed : existingTask.completed},
                due_date = ${taskData.due_date !== undefined ? taskData.due_date : existingTask.due_date},
                priority = ${taskData.priority !== undefined ? taskData.priority : existingTask.priority},
                recurrence = ${taskData.recurrence !== undefined ? taskData.recurrence : existingTask.recurrence},
                is_all_day = ${taskData.is_all_day !== undefined ? taskData.is_all_day : existingTask.is_all_day},
                due_time = ${taskData.is_all_day ? null : (taskData.due_time !== undefined ? taskData.due_time : existingTask.due_time)}
            WHERE id = ${taskData.id} AND user_id = ${userId}
            RETURNING *
        `;

        const googleEventId = await syncTaskWithGoogle(userId, updatedTask);
        if (googleEventId && updatedTask.google_event_id !== googleEventId) {
            await sql`UPDATE tasks SET google_event_id = ${googleEventId} WHERE id = ${updatedTask.id}`;
            updatedTask.google_event_id = googleEventId;
        }

        return { statusCode: 200, body: JSON.stringify({ updatedTask, newRecurringTask }) };
      }

      case 'DELETE': {
        const { id } = JSON.parse(event.body!);
        const [taskToDelete] = await sql`SELECT google_event_id FROM tasks WHERE id = ${id} AND user_id = ${userId}`;

        if (taskToDelete && taskToDelete.google_event_id) {
            await deleteGoogleItem(userId, taskToDelete.google_event_id);
        }

        await sql`DELETE FROM tasks WHERE id = ${id} AND user_id = ${userId}`;
        return { statusCode: 200, body: JSON.stringify({ message: 'Task deleted successfully.' }) };
      }

      default:
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
  }
};
