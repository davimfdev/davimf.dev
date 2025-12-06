import { google } from 'googleapis';
import { neon } from '@neondatabase/serverless';
import CryptoJS from 'crypto-js';
import { Auth } from 'googleapis';

// **CORREÇÃO APLICADA AQUI:** Usando NETLIFY_DATABASE_URL
const sql = neon(process.env.NETLIFY_DATABASE_URL!);
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

const decrypt = (ciphertext: string): string => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

export const getGoogleAuthClient = async (userId: number): Promise<Auth.OAuth2Client | null> => {
  const result = await sql`
    SELECT refresh_token_encrypted 
    FROM google_calendar_integrations 
    WHERE user_id = ${userId}
  `;
  if (result.length === 0) return null;

  const encryptedToken = result[0].refresh_token_encrypted;
  const refreshToken = decrypt(encryptedToken);
  if (!refreshToken) return null;

  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    await oauth2Client.refreshAccessToken();
  } catch (error) {
    console.error(`Falha ao atualizar o access token para o usuário ${userId}:`, error);
    return null;
  }
  return oauth2Client;
};

export const formatTaskAsGoogleEvent = (task: any) => {
  const { text, due_date, due_time, is_all_day } = task;
  
  if (!due_date || isNaN(new Date(due_date).getTime())) {
    return null;
  }

  let start, end;
  if (is_all_day) {
    start = { date: due_date };
    const endDate = new Date(due_date);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    end = { date: endDate.toISOString().split('T')[0] };
  } else if (due_time) {
    const startTime = new Date(`${due_date}T${due_time}`);
    if (isNaN(startTime.getTime())) return null;
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    start = { dateTime: startTime.toISOString(), timeZone: 'America/Sao_Paulo' };
    end = { dateTime: endTime.toISOString(), timeZone: 'America/Sao_Paulo' };
  } else {
    start = { date: due_date };
    const endDate = new Date(due_date);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    end = { date: endDate.toISOString().split('T')[0] };
  }
  return { summary: text, start, end };
};

const fetchGoogleEvents = async (auth: Auth.OAuth2Client) => {
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });
    const items = response.data.items || [];
    return items.map(event => ({
      id: event.id!,
      summary: event.summary || 'Evento sem título',
      isAllDay: !!event.start?.date,
      dueDate: event.start?.date || (event.start?.dateTime ? new Date(event.start.dateTime).toISOString().split('T')[0] : null),
      dueTime: event.start?.dateTime ? new Date(event.start.dateTime).toTimeString().split(' ')[0] : null,
    }));
  } catch (error) {
    console.error('Erro ao buscar eventos do Google Calendar:', error);
    return [];
  }
};

const fetchGoogleTasks = async (auth: Auth.OAuth2Client) => {
  const tasksApi = google.tasks({ version: 'v1', auth });
  try {
    const taskLists = await tasksApi.tasklists.list({ maxResults: 10 });
    if (!taskLists.data.items) return [];

    let allTasks: any[] = [];
    for (const taskList of taskLists.data.items) {
      const response = await tasksApi.tasks.list({
        tasklist: taskList.id!,
        showCompleted: false,
        maxResults: 100,
      });
      if (response.data.items) {
        allTasks = allTasks.concat(response.data.items);
      }
    }
    
    return allTasks.map(task => ({
      id: task.id!,
      summary: task.title || 'Tarefa sem título',
      isAllDay: true,
      dueDate: task.due ? new Date(task.due).toISOString().split('T')[0] : null,
      dueTime: null,
    }));
  } catch (error) {
    console.error('Erro ao buscar tarefas do Google Tasks:', error);
    return [];
  }
};

export const fetchInitialGoogleData = async (auth: Auth.OAuth2Client) => {
  const [events, tasks] = await Promise.all([fetchGoogleEvents(auth), fetchGoogleTasks(auth)]);
  
  const combined = [...events, ...tasks];
  return combined
    .filter(item => item.dueDate)
    .map(item => ({
      text: item.summary,
      completed: false,
      due_date: item.dueDate,
      priority: 'Medium',
      recurrence: 'None',
      is_all_day: item.isAllDay,
      due_time: item.dueTime,
      google_event_id: `google_${item.id}`,
    }));
};
