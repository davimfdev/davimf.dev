import { neon } from '@neondatabase/serverless';

// Neon de CONFIG DO BOT — projeto separado do banco do site (DATABASE_URL). Só server-side.
export const botSql = neon(process.env.BOT_CONFIG_DATABASE_URL!);
