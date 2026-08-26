import express, { type NextFunction, type Request as ExpressRequest, type Response as ExpressResponse } from 'express';
import { allowedOriginsFromEnv, corsMiddleware } from './middleware/cors';
import {
  NETLIFY_STYLE_ROUTES,
  WEB_STYLE_ROUTES,
  allRoutePaths,
  asNetlifyHandler,
  asWebHandler,
} from './routes/functions';
import { runNetlifyHandler } from './utils/netlifyAdapter';
import { runWebHandler } from './utils/webAdapter';

/** Notas e configurações do dashboard podem passar do limite padrão de 100kb. */
const BODY_LIMIT = process.env.BODY_LIMIT ?? '5mb';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Atrás do Nginx Proxy Manager: faz req.protocol/req.ip lerem X-Forwarded-*,
  // o que mantém as URLs absolutas em https://davimf.dev e os cookies Secure.
  app.set('trust proxy', true);

  app.use(corsMiddleware(allowedOriginsFromEnv()));

  // Corpo sempre CRU (Buffer), nunca desserializado aqui: cada handler antigo faz
  // o próprio JSON.parse(event.body) / req.json(). Isso também preserva o corpo
  // byte a byte, que é o que uma futura verificação de assinatura de webhook exige.
  app.use(express.raw({ type: () => true, limit: BODY_LIMIT }));

  app.get(['/health', '/api/health'], (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  for (const route of NETLIFY_STYLE_ROUTES) {
    app.all(route.paths, (req, res, next) => {
      route
        .load()
        .then((module) => runNetlifyHandler(asNetlifyHandler(module, route.name), req, res))
        .catch(next);
    });
  }

  for (const route of WEB_STYLE_ROUTES) {
    app.all(route.paths, (req, res, next) => {
      route
        .load()
        .then((module) => runWebHandler(asWebHandler(module, route.name), req, res))
        .catch(next);
    });
  }

  // Diagnóstico: confere rapidamente se o container expõe o que se espera.
  app.get('/api/_routes', (_req, res) => {
    res.status(200).json({ routes: allRoutePaths() });
  });

  app.use('/api', (req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: `No API route for ${req.method} ${req.originalUrl}` },
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not Found' } });
  });

  app.use((error: unknown, req: ExpressRequest, res: ExpressResponse, _next: NextFunction) => {
    console.error(`[api] ${req.method} ${req.originalUrl} falhou:`, error);
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal error.' } });
  });

  return app;
}
