import { closeAllPools, describeDatabases } from '../../netlify/functions/lib/db';
import { createApp } from './app';
import {
  applyCompatibilityEnv,
  loadEnvFileIfPresent,
  logDatabaseTargets,
  logEnvSummary,
  warnMissingEnv,
} from './utils/env';

// Ordem importa: ler o .env (quando existe) antes de resolver a URL pública,
// e resolver a URL antes de reportar o que está faltando.
const envFile = loadEnvFileIfPresent();
const siteUrl = applyCompatibilityEnv();
logEnvSummary(envFile, siteUrl);
logDatabaseTargets(describeDatabases());
warnMissingEnv();

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const server = createApp().listen(port, host, () => {
  console.log(`[api] davimf-api ouvindo em http://${host}:${port} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`[api] ${signal} recebido, encerrando...`);
    // Para de aceitar requisição, depois devolve as conexões do pool ao
    // Postgres. Com o driver HTTP da Neon não havia socket para fechar; com TCP,
    // sair sem encerrar deixa conexões penduradas até o timeout do servidor.
    server.close(() => {
      void closeAllPools().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
