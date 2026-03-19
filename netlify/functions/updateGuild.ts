import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Conectando ao Supabase (as chaves ficam nas variáveis de ambiente da Netlify)
const supabase = createClient(
    process.env.DATABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export const handler: Handler = async (event) => {
    // 1. O site envia os dados no corpo da requisição
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const { guildId, prefix, cor, cargoEntrada, userToken } = JSON.parse(event.body || '{}');

    if (!guildId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing guildId' }) };
    }

    if (!userToken) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: No token provided' }) };
    }

    // 3. Atualizando TUDO no Supabase de uma vez
    const { error } = await supabase
        .from('guilds')
        .update({
            prefix: prefix,
            cor: cor,
            cargo_entrada: cargoEntrada
        })
        .eq('id', guildId);

    if (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    // 4. Retorna sucesso para o site atualizar a tela
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Configurações atualizadas com sucesso!' }),
    };
};