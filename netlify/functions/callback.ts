import { Config, Context } from '@netlify/functions';

export default async (req: Request, context: Context) => {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    if (!code) {
        return new Response('Código não fornecido', { status: 400 });
    }

    // LÓGICA DE REDIRECIONAMENTO DINÂMICO
    // Se o host contiver 'localhost', ele usa o link de teste, senão usa o oficial
    const host = req.headers.get('host') || '';
    const isLocal = host.includes('localhost');
    const redirectUri = isLocal
        ? 'http://localhost:8888/api/callback'
        : 'https://davimf.dev/api/callback';

    const data = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri, // Agora ele envia o link certo dependendo de onde você está
    });

    try {
        const response = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data,
        });

        const tokens = await response.json();

        if (tokens.error) {
            console.error('Erro Discord:', tokens);
            return new Response(JSON.stringify(tokens), { status: 400 });
        }

        // Redireciona de volta para o site com o token na URL
        // O Layout.tsx vai capturar esse token e salvar no localStorage
        const redirectBase = isLocal ? 'http://localhost:8888' : 'https://davimf.dev';
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${redirectBase}/?token=${tokens.access_token}`,
            },
        });

    } catch (error) {
        return new Response('Erro interno', { status: 500 });
    }
};

// Define a rota curta /api/callback
export const config: Config = {
    path: "/api/callback",
};