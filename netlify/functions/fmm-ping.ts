import { sql, verifyHmac, jsonResponse, errorResponse } from './lib/fmm-license.js';

/**
 * Contagem anônima de instalações do FMM.
 *
 * Existe porque o nível gratuito não exige chave: sem isto a API de licença só
 * enxerga quem paga, e não há denominador para calcular conversão nem para
 * aferir os limites do plano FREE.
 *
 * O app envia no máximo uma vez a cada 24h. O corpo tem só o hash de HWID que
 * ele já calcula para a licença, a versão e o nível — nada que identifique a
 * pessoa. Ver `telemetry.go` no FMM.
 *
 * É assinado pelo mesmo HMAC das rotas de licença, com `key_hash` vazio porque
 * uma instalação gratuita não tem chave. Sem assinatura, qualquer um poderia
 * inflar a contagem com hashes aleatórios e envenenar exatamente a métrica que
 * justifica a existência da rota.
 */
const HEX64 = /^[0-9a-f]{64}$/;
const NIVEIS = new Set(['free', 'basic', 'pro']);

// Sem o segundo parametro (Context) das outras funcoes: ele nunca e usado aqui
// e o eslint do projeto trata parametro nao usado como erro.
export default async (req: Request) => {
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  let body: {
    hwid_hash?: string;
    version?: string;
    level?: string;
    timestamp?: string;
    hmac?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON');
  }

  const { hwid_hash, version, level, timestamp, hmac } = body;
  if (!hwid_hash || !timestamp || !hmac) return errorResponse('Missing fields');

  // O HWID chega sempre como SHA-256 em hex. Recusar o resto evita que lixo
  // vire linha na tabela e distorça a contagem.
  if (!HEX64.test(hwid_hash)) return errorResponse('Invalid hwid_hash');

  // Instalação gratuita não tem chave, então a assinatura cobre apenas o HWID
  // e o instante, com key_hash vazio.
  if (!verifyHmac('', hwid_hash, timestamp, hmac)) {
    return errorResponse('Invalid signature', 401);
  }

  const nivel = NIVEIS.has(String(level)) ? String(level) : 'free';
  // Versão vem de ldflags e pode ser 'dev' numa build local; limitar o tamanho
  // impede que um campo livre cresça sem controle.
  const versao = String(version ?? '').slice(0, 32) || null;

  await sql`
    INSERT INTO fmm_installs (hwid_hash, last_version, last_level)
    VALUES (${hwid_hash}, ${versao}, ${nivel})
    ON CONFLICT (hwid_hash) DO UPDATE SET
      last_seen_at = NOW(),
      last_version = EXCLUDED.last_version,
      last_level   = EXCLUDED.last_level,
      ping_count   = fmm_installs.ping_count + 1
  `;

  // O app não usa a resposta; devolver o mínimo evita transformar esta rota
  // num canal de leitura.
  return jsonResponse({ ok: true });
};
