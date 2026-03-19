import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

export const handler: Handler = async (event) => {
    // Inicialização movida para DENTRO da função para evitar o erro de URL vazia
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Configuração do banco ausente.' }) };
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

        // Pega apenas servidores onde o usuário é Admin/Dono
        const adminGuilds = guilds.filter((guild: any) => {
            const isOwner = guild.owner === true;
            const permissions = BigInt(guild.permissions);
            const isAdmin = (permissions & BigInt(0x8)) === BigInt(0x8);
            const canManageGuild = (permissions & BigInt(0x20)) === BigInt(0x20);
            return isOwner || isAdmin || canManageGuild;
        });

        if (adminGuilds.length === 0) {
            return { statusCode: 200, body: JSON.stringify([]) };
        }

        const adminGuildIds = adminGuilds.map((g: any) => g.id);

        // Verifica no Supabase em quais desses servidores o bot já está
        const { data: botGuildsData, error: dbError } = await supabase
            .from('guilds')
            .select('id')
            .in('id', adminGuildIds);

        if (dbError) throw dbError;

        // Injeta a propriedade "hasBot" em cada servidor
        const botGuildIds = botGuildsData.map((dbGuild: any) => dbGuild.id);
        const finalGuilds = adminGuilds.map((guild: any) => ({
            ...guild,
            hasBot: botGuildIds.includes(guild.id)
        }));

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalGuilds),
        };

    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno no servidor' }) };
    }
};