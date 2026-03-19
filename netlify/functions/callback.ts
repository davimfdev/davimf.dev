import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
    // 1. Pega o código que o Discord enviou na URL
    const code = event.queryStringParameters?.code;

    if (!code) {
        return { statusCode: 400, body: 'Código de autorização não fornecido.' };
    }

    // 2. Prepara os dados para trocar o código pelo Token
    const data = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'http://localhost:8888/.netlify/functions/callback', // Confirme se está igual!
    });

    try {
        // 3. Faz a requisição para a API do Discord
        const response = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data,
        });

        const tokens = await response.json();

        if (tokens.error) {
            return { statusCode: 400, body: JSON.stringify(tokens) };
        }

        // 4. Sucesso! Aqui você tem o access_token.
        // O ideal agora é redirecionar o usuário para a página do Dashboard
        // enviando o token junto (via URL ou Cookie).

        return {
            statusCode: 302, // Redirecionamento
            headers: {
                Location: `/dashboard?token=${tokens.access_token}`,
            },
        };

    } catch (error) {
        return { statusCode: 500, body: 'Erro interno no servidor' };
    }
};