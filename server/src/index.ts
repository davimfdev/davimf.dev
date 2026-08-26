import { createApp } from './app';
import { applyCompatibilityEnv, warnMissingEnv } from './utils/env';

applyCompatibilityEnv();
warnMissingEnv();

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const server = createApp().listen(port, host, () => {
  console.log(`[api] davimf-api ouvindo em http://${host}:${port} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`[api] ${signal} recebido, encerrando...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
