const ALLOWED = [
  'https://davimf.dev',
  'http://localhost:8888',
  'http://localhost:5173',
];

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Só permite métodos mutantes vindos do domínio oficial (Origin, senão Referer). */
export function allowedOrigin(event: { httpMethod: string; headers: Record<string, string | undefined> }): boolean {
  if (!MUTATING.has(event.httpMethod)) return true;
  const h = event.headers || {};
  const src = h.origin || h.Origin || h.referer || h.Referer || '';
  try {
    return ALLOWED.includes(new URL(src).origin);
  } catch {
    return false;
  }
}
