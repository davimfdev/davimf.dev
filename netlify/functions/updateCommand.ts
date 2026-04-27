import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const { id, guildId, is_enabled, userToken } = JSON.parse(event.body || '{}');

    if (!id || !guildId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing id or guildId' }) };
    }

    if (!userToken) {
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

    const { error } = await supabase
        .from('command_configs')
        .update({
            is_enabled: is_enabled
        })
        .eq('id', id)
        .eq('guild_id', guildId);

    if (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Comando atualizado com sucesso!' }),
    };
};
