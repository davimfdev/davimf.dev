import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

    const { guildId } = event.queryStringParameters || {};
    const authHeader = event.headers.authorization;

    if (!guildId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing guildId' }) };
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: No token provided' }) };
    }

    let supabaseUrl = process.env.SUPABASE_URL || '';
    let supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

    supabaseUrl = supabaseUrl.replace(/^['"]|['"]$/g, '');
    supabaseKey = supabaseKey.replace(/^['"]|['"]$/g, '');

    if (supabaseUrl.startsWith('postgres')) {
        const match = supabaseUrl.match(/@db\.([a-z0-9-]+)\.supabase\.co/);
        if (match) {
            supabaseUrl = `https://${match[1]}.supabase.co`;
        } else {
             return { statusCode: 500, body: JSON.stringify({ error: 'Configuração do banco inválida.' }) };
        }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: commandsData, error: commandsError } = await supabase
        .from('command_configs')
        .select('*')
        .eq('guild_id', guildId);

    if (commandsError) {
        return { statusCode: 500, body: JSON.stringify({ error: commandsError.message }) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ data: commandsData || [] }),
    };
};
