import {
  ApiError,
  errorResponse,
  jsonResponse,
  requireAllowedOrigin,
  shouldUseSecureCookies,
  withElf,
} from './lib/http';
import { clearedSessionCookie, requireElfSession, revokeSessionById } from './lib/session';

type Deps = {
  requireSession?: typeof requireElfSession;
  revoke?: typeof revokeSessionById;
};

/** POST /api/elf/auth/logout — revoga a sessão atual no servidor. */
export async function handleAuthLogout(req: Request, deps: Deps = {}): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse(new ApiError('VALIDATION_FAILED', 'Método não permitido.', 400), req);
  }
  const auth = await (deps.requireSession ?? requireElfSession)(req);
  if (!auth.ok) {
    return errorResponse(new ApiError(auth.code, 'Sessão inválida.', auth.status), req);
  }

  requireAllowedOrigin(req, auth.isCookieAuth);

  // Revogar no servidor é o que encerra a sessão. Apagar o cookie sozinho não encerra nada.
  await (deps.revoke ?? revokeSessionById)(auth.session.id, auth.session.userId);

  return jsonResponse({ ok: true }, 200, req, {
    'Set-Cookie': clearedSessionCookie(shouldUseSecureCookies(req)),
  });
}

export default withElf((req) => handleAuthLogout(req));
