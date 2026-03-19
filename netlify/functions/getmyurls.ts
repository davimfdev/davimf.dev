import { Config, Context } from '@netlify/functions';
import { neon } from '@netlify/neon';

export default async (req: Request, context: Context) => {
    if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    try {
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!userRes.ok) return new Response(JSON.stringify({ error: 'Invalid Token' }), { status: 401 });

        const user = await userRes.json();
        const sql = neon(process.env.DATABASE_URL!);

        const urls = await sql`SELECT * FROM urls WHERE user_id = ${user.id} ORDER BY created_at DESC`;

        return new Response(JSON.stringify(urls || []), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

export const config: Config = { path: "/api/getmyurls" };