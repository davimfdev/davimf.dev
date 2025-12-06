import { Context } from '@netlify/functions';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';
import CryptoJS from 'crypto-js';
import { fetchInitialGoogleData, formatTaskAsGoogleEvent, getGoogleAuthClient } from './google-calendar-helpers';

// **CORREÇÃO APLICADA AQUI:** Usando NETLIFY_DATABASE_URL
const sql = neon(process.env.NETLIFY_DATABASE_URL!);

interface TokenPayload {
  userId: string;
}

const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!GOOGLE_REDIRECT_URI || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !ENCRYPTION_KEY) {
  throw new Error("Variáveis de ambiente essenciais do Google ou de criptografia não estão definidas.");
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

const scopes = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks'
];

const encrypt = (text: string): string => {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY!).toString();
};

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (req.method === 'GET' && !code) {
    const userAuthToken = req.headers.get('Authorization')?.split(' ')[1];
    if (!userAuthToken) {
      return new Response(JSON.stringify({ message: 'Unauthorized: Missing authentication token.' }), { status: 401 });
    }
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: userAuthToken
    });
    return new Response(JSON.stringify({ url: authUrl }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (req.method === 'GET' && code) {
    if (!state) {
      return new Response('Invalid request: missing state.', { status: 400 });
    }

    const userAuthToken = state;
    const successUrl = new URL('/todo?google_auth=success', url.origin);
    const errorUrl = new URL('/todo?google_auth=error', url.origin);

    try {
      const decoded = jwt.verify(userAuthToken, process.env.JWT_SECRET!) as TokenPayload;
      const userId = decoded.userId;

      const { tokens } = await oauth2Client.getToken(code);
      const { refresh_token } = tokens;

      if (!refresh_token) throw new Error("Refresh token não foi recebido do Google.");

      const encryptedToken = encrypt(refresh_token);

      await sql`
        INSERT INTO google_calendar_integrations (user_id, refresh_token_encrypted)
        VALUES (${userId}, ${encryptedToken})
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
          updated_at = NOW();
      `;

      const authClient = await getGoogleAuthClient(Number(userId));
      if (!authClient) throw new Error("Falha ao obter cliente de autenticação do Google.");

      const initialData = await fetchInitialGoogleData(authClient);
      if (initialData.length > 0) {
        const tasksToInsert = initialData.map(task => ({ ...task, user_id: userId }));
        await sql`
            INSERT INTO tasks (text, completed, due_date, priority, recurrence, is_all_day, due_time, google_event_id, user_id)
            SELECT text, completed, due_date::date, priority, recurrence, is_all_day, due_time::time, google_event_id, user_id
            FROM json_populate_recordset(null::tasks, ${JSON.stringify(tasksToInsert)})
            ON CONFLICT (google_event_id) DO NOTHING;
        `;
      }

      const calendar = google.calendar({ version: 'v3', auth: authClient });
      const tasksToExport = await sql`SELECT * FROM tasks WHERE user_id = ${userId} AND google_event_id IS NULL`;

      for (const task of tasksToExport) {
        const event = formatTaskAsGoogleEvent(task);
        if (event) {
          try {
            const createdEvent = await calendar.events.insert({
              calendarId: 'primary',
              requestBody: event,
            });
            const googleEventId = `google_${createdEvent.data.id}`;
            await sql`UPDATE tasks SET google_event_id = ${googleEventId} WHERE id = ${task.id}`;
          } catch (e) {
            console.error(`Falha ao exportar tarefa ${task.id} para o Google:`, e);
          }
        }
      }

      return Response.redirect(successUrl.href, 302);

    } catch (error) {
      console.error('Erro durante o callback do Google OAuth:', error);
      return Response.redirect(errorUrl.href, 302);
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
};
