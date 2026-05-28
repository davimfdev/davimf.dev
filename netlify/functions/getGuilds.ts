import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

export const handler: Handler = async (event, context) => {
    let supabaseUrl = process.env.SUPABASE_URL || '';
    let supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

    supabaseUrl = supabaseUrl.replace(/^['"]|['"]$/g, '');
    supabaseKey = supabaseKey.replace(/^['"]|['"]$/g, '');

    if (supabaseUrl.startsWith('postgres')) {
        const match = supabaseUrl.match(/@db\.([a-z0-9-]+)\.supabase\.co/);
        if (match) {
            supabaseUrl = `https://${match[1]}.supabase.co`;
        } else {
             console.error('Invalid postgres url format for Supabase:', supabaseUrl);
             return { statusCode: 500, body: JSON.stringify({ error: 'Configuração do banco inválida.' }) };
        }
    }

    if (!supabaseUrl || (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://'))) {
        console.error('Missing or invalid SUPABASE_URL:', supabaseUrl);
        return { statusCode: 500, body: JSON.stringify({ error: 'Configuração do banco ausente ou url invalida.' }) };
    }

    if (!supabaseKey) {
        console.error('Missing SUPABASE_SERVICE_KEY');
        return { statusCode: 500, body: JSON.stringify({ error: 'Chave do banco ausente.' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const authHeader = event.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Token não fornecido ou inválido.' }) };
    }

    const token = authHeader.split(' ')[1];

    try {
        const response = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return { statusCode: response.status, body: JSON.stringify({ error: 'Falha ao buscar servidores no Discord.' }) };

        const guilds = await response.json();

        const adminGuilds = guilds.filter((guild: any) => {
            const isOwner = guild.owner === true;
            // O Discord envia permissions como string numérica gigante
            const permissions = BigInt(guild.permissions);
            const isAdmin = (permissions & BigInt(0x8)) === BigInt(0x8);
            const canManageGuild = (permissions & BigInt(0x20)) === BigInt(0x20);
            return isOwner || isAdmin || canManageGuild;
        });

        if (adminGuilds.length === 0) {
            return { statusCode: 200, body: JSON.stringify([]) };
        }

        const adminGuildIds = adminGuilds.map((g: any) => g.id);

        const { data: botGuildsData, error: dbError } = await supabase
            .from('guilds')
            .select('id')
            .in('id', adminGuildIds);

        if (dbError) throw dbError;

        const botGuildIds = botGuildsData ? botGuildsData.map((dbGuild: any) => dbGuild.id) : [];
        const finalGuilds = adminGuilds.map((guild: any) => ({
            ...guild,
            // Garante comparação como string caso o banco retorne diferente
            hasBot: botGuildIds.some((id: any) => String(id) === String(guild.id))
        }));

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalGuilds),
        };

    } catch (error) {
        console.error(error);

        const msg = error instanceof Error ? error.message : String(error);

        fetch('https://formspree.io/f/meoekelg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Alerta Automático — Site',
                email: 'davimf9702@gmail.com',
                message: `⚠️ Erro crítico em getGuilds (provável Supabase offline).\n\nHorário: ${new Date().toISOString()}\nErro: ${msg}`,
            }),
        }).catch(() => {});

        return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno no servidor' }) };
    }
};
