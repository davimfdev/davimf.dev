import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';
import jwt from 'jsonwebtoken';

interface UserPayload {
  userId: number;
  email: string;
  jti: string;
  exp: number;
}

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

const getUserIdFromToken = async (req: Request): Promise<number | null> => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET!;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as UserPayload;

    const blacklisted = await sql`SELECT 1 FROM token_blacklist WHERE jti = ${payload.jti}`;
    if (blacklisted.length > 0) {
      console.warn('Attempted to use a blacklisted token.');
      return null;
    }

    return payload.userId;
  } catch (error) {
    console.error('Invalid token:', error);
    return null;
  }
};

const getNextDueDate = (currentDueDate: string, recurrence: 'Daily' | 'Weekly' | 'Monthly'): string => {
    const date = new Date(currentDueDate);
    // Adjust for timezone offset to prevent date shifts
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);

    if (recurrence === 'Daily') {
        correctedDate.setDate(correctedDate.getDate() + 1);
    } else if (recurrence === 'Weekly') {
        correctedDate.setDate(correctedDate.getDate() + 7);
    } else if (recurrence === 'Monthly') {
        correctedDate.setMonth(correctedDate.getMonth() + 1);
    }
    return correctedDate.toISOString().split('T')[0];
};

export default async (req: Request, context: Context) => {
  const userId = await getUserIdFromToken(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const tasks = await sql`
          SELECT id, text, completed, due_date, priority, recurrence, is_all_day, due_time 
          FROM tasks 
          WHERE user_id = ${userId} 
          ORDER BY due_date ASC, due_time ASC, created_at DESC
        `;
        return new Response(JSON.stringify(tasks), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'POST': {
        const { text, due_date, priority, recurrence, is_all_day, due_time } = await req.json();
        if (!text) {
          return new Response(JSON.stringify({ error: 'Task text is required.' }), { status: 400 });
        }
        const result = await sql`
          INSERT INTO tasks (text, user_id, due_date, priority, recurrence, is_all_day, due_time) 
          VALUES (${text}, ${userId}, ${due_date || null}, ${priority || 'Medium'}, ${recurrence || 'None'}, ${is_all_day}, ${is_all_day ? null : due_time}) 
          RETURNING *
        `;
        return new Response(JSON.stringify(result[0]), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'PUT': {
        const { id, text, completed, due_date, priority, recurrence, is_all_day, due_time } = await req.json();
        if (id === undefined) {
          return new Response(JSON.stringify({ error: 'Task ID is required.' }), { status: 400 });
        }

        const [existingTask] = await sql`SELECT * FROM tasks WHERE id = ${id} AND user_id = ${userId}`;
        if (!existingTask) {
          return new Response(JSON.stringify({ error: 'Task not found or permission denied.' }), { status: 404 });
        }

        let newRecurringTask = null;
        if (completed && !existingTask.completed && existingTask.recurrence !== 'None' && existingTask.due_date) {
            const nextDate = getNextDueDate(existingTask.due_date, existingTask.recurrence);
            [newRecurringTask] = await sql`
                INSERT INTO tasks (text, user_id, due_date, priority, recurrence, is_all_day, due_time)
                VALUES (${existingTask.text}, ${userId}, ${nextDate}, ${existingTask.priority}, ${existingTask.recurrence}, ${existingTask.is_all_day}, ${existingTask.due_time})
                RETURNING *
            `;
        }
        
        const updatedTaskResult = await sql`
            UPDATE tasks 
            SET 
                text = ${text !== undefined ? text : existingTask.text},
                completed = ${completed !== undefined ? completed : existingTask.completed},
                due_date = ${due_date !== undefined ? due_date : existingTask.due_date},
                priority = ${priority !== undefined ? priority : existingTask.priority},
                recurrence = ${recurrence !== undefined ? recurrence : existingTask.recurrence},
                is_all_day = ${is_all_day !== undefined ? is_all_day : existingTask.is_all_day},
                due_time = ${is_all_day ? null : (due_time !== undefined ? due_time : existingTask.due_time)}
            WHERE id = ${id} AND user_id = ${userId}
            RETURNING *
        `;

        return new Response(JSON.stringify({ updatedTask: updatedTaskResult[0], newRecurringTask }), { status: 200 });
      }

      case 'DELETE': {
        const { id } = await req.json();
        if (id === undefined) {
          return new Response(JSON.stringify({ error: 'Task ID is required.' }), { status: 400 });
        }
        const result = await sql`DELETE FROM tasks WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
        if (result.length === 0) {
          return new Response(JSON.stringify({ error: 'Task not found or permission denied.' }), { status: 404 });
        }
        return new Response(JSON.stringify({ message: 'Task deleted successfully.' }), { status: 200 });
      }

      default:
        return new Response('Method Not Allowed', { status: 405 });
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = {
  path: "/api/tasks",
};
