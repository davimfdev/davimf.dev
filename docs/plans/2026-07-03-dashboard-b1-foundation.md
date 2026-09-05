# Parte B1 (site) - Fundação segura do dashboard de config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Construir a base de backend (Netlify Functions) que fala com o **Neon de config do bot** com **autorização owner-first + bot presente** e **proteção de Origin**, de forma **aditiva e não-quebra** - funções novas guardadas; funções/frontend antigos (stub Supabase) ficam intactos até a fase do frontend.

**Architecture:** Libs compartilhadas em `netlify/functions/lib/` - `botDb` (conexão Neon do bot via `BOT_CONFIG_DATABASE_URL`), `requireGuildAccess` (owner-first + `bot_guilds.bot_present`), `cors` (Origin/Referer em métodos mutantes), `guildConfig` (leitura + escrita **merge por chave** dos mapas JSONB, preservando `dashboard_access`). Três funções novas usam essas libs: `guild-config-get`, `guild-config-set`, `bot-guilds-list`. Vitest cobre a lógica pura (Origin, merge, authz) com `fetch`/`sql` mockados.

**Tech Stack:** Vite/React SPA + Netlify Functions (TypeScript), `@neondatabase/serverless`, vitest. Repo: `davimf.dev` (branch `main` limpo → commits por task).

## Contrato de schema (fonte-verdade)

`BaseBot/docs/superpowers/dashboard-config-schema-contract.md`. Tabelas relevantes no Neon do bot (já aplicadas):
- `guild_config(guild_id PK, log_channel_id, ticket_log_channel_id, channels jsonb, roles jsonb, toggles jsonb, staff_role_ids jsonb, settings jsonb, dashboard_access jsonb, updated_at)`.
- `bot_guilds(guild_id PK, bot_instance_id, guild_name, owner_id, bot_present, last_seen_at)`.

## Global Constraints

- **Neon do bot é projeto SEPARADO** do banco do site. Nova env var **`BOT_CONFIG_DATABASE_URL`** (não reusar `DATABASE_URL`). Cliente próprio em `lib/botDb.ts`.
- **owner-first (v1):** só o **dono** do servidor (Discord `owner:true` em `/users/@me/guilds`) **e** com bot presente (`bot_guilds.bot_present=true`). Delegação (`dashboard_access`) é v2.
- **Merge, nunca sobrescrever mapa:** escritas em `channels`/`roles`/`toggles`/`settings` usam `coalesce(col,'{}'::jsonb) || $patch::jsonb`. **`dashboard_access` nunca é escrita por estas funções.**
- **Allowlist de chaves:** só chaves conhecidas (do contrato) entram nos mapas.
- **CSRF/Origin:** métodos `POST/PUT/PATCH/DELETE` exigem Origin/Referer do domínio oficial.
- **Não-quebra:** não tocar nas funções antigas (`getGuildConfig`/`updateGuild`/`getSecurityConfig`/`updateSecurityConfig`/`getGuilds`) nem no frontend nesta fase.
- **IDs do Discord são string.** Snowflake nunca vira `Number`.
- **Segredos server-side.** `BOT_CONFIG_DATABASE_URL` só nas env vars do Netlify.

## Pré-requisito de infra (manual, antes do deploy)

Adicionar `BOT_CONFIG_DATABASE_URL` nas env vars do Netlify = string de conexão do **Neon de config do bot** (o mesmo que o bot usa; `sslmode=require`). Sem ela as funções novas retornam 500 em runtime - mas o código e os testes (com `sql`/`fetch` mockados) não precisam dela.

## File Structure

- `netlify/functions/lib/botDb.ts` - **novo**: `export const botSql = neon(process.env.BOT_CONFIG_DATABASE_URL!)`.
- `netlify/functions/lib/cors.ts` - **novo**: `allowedOrigin(event)`.
- `netlify/functions/lib/requireGuildAccess.ts` - **novo**: authz owner-first + bot_present.
- `netlify/functions/lib/guildConfig.ts` - **novo**: read + merge-write dos mapas.
- `netlify/functions/guild-config-get.ts` - **novo**.
- `netlify/functions/guild-config-set.ts` - **novo**.
- `netlify/functions/bot-guilds-list.ts` - **novo**.
- `netlify/functions/lib/__tests__/*.test.ts` - **novos**: vitest.

---

## Task 1: `lib/botDb.ts` + `lib/cors.ts` (+ teste do cors)

**Files:**
- Create: `netlify/functions/lib/botDb.ts`, `netlify/functions/lib/cors.ts`
- Test: `netlify/functions/lib/__tests__/cors.test.ts`

**Interfaces:**
- Produces: `botSql` (neon tagged-template); `allowedOrigin(event): boolean`.

- [ ] **Step 1: `botDb.ts`**

```ts
import { neon } from '@neondatabase/serverless';

// Neon de CONFIG DO BOT - projeto separado do banco do site (DATABASE_URL). Só server-side.
export const botSql = neon(process.env.BOT_CONFIG_DATABASE_URL!);
```

- [ ] **Step 2: teste do cors (falha primeiro)**

Create `netlify/functions/lib/__tests__/cors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { allowedOrigin } from '../cors';

const ev = (method: string, headers: Record<string, string> = {}) =>
  ({ httpMethod: method, headers } as any);

describe('allowedOrigin', () => {
  it('permite GET sem checar origin', () => {
    expect(allowedOrigin(ev('GET'))).toBe(true);
  });
  it('permite POST do domínio oficial', () => {
    expect(allowedOrigin(ev('POST', { origin: 'https://davimf.dev' }))).toBe(true);
  });
  it('bloqueia POST de origin estranho', () => {
    expect(allowedOrigin(ev('POST', { origin: 'https://evil.example' }))).toBe(false);
  });
  it('bloqueia POST sem origin nem referer', () => {
    expect(allowedOrigin(ev('POST'))).toBe(false);
  });
  it('aceita referer quando origin ausente', () => {
    expect(allowedOrigin(ev('PUT', { referer: 'https://davimf.dev/dashboard' }))).toBe(true);
  });
});
```

Run: `npm test -- cors` → FAIL (módulo não existe).

- [ ] **Step 3: `cors.ts`**

```ts
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
  return ALLOWED.some((a) => src.startsWith(a));
}
```

Run: `npm test -- cors` → PASS (5).

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/lib/botDb.ts netlify/functions/lib/cors.ts netlify/functions/lib/__tests__/cors.test.ts
git commit -m "feat(dashboard): bot Neon client + Origin/CORS guard"
```

---

## Task 2: `lib/requireGuildAccess.ts` (owner-first + bot_present)

**Files:**
- Create: `netlify/functions/lib/requireGuildAccess.ts`
- Test: `netlify/functions/lib/__tests__/requireGuildAccess.test.ts`

**Interfaces:**
- Consumes: `botSql` (para `bot_guilds`), `fetch` (Discord).
- Produces: `type Access = { ok: true; userId: string } | { ok: false; status: number; error: string }`; `requireGuildAccess(event, guildId): Promise<Access>`; injeção de deps para teste via segundo parâmetro opcional `{ fetchImpl, sql }`.

- [ ] **Step 1: teste (falha primeiro)**

Create `netlify/functions/lib/__tests__/requireGuildAccess.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { requireGuildAccess } from '../requireGuildAccess';

const ev = (auth?: string) => ({ headers: auth ? { authorization: `Bearer ${auth}` } : {} } as any);

// fetch fake: /users/@me -> {id}, /users/@me/guilds -> lista
function fakeFetch(userId: string | null, guilds: any[]) {
  return vi.fn(async (url: string) => {
    if (url.endsWith('/users/@me')) {
      return { ok: !!userId, json: async () => ({ id: userId }) } as any;
    }
    if (url.endsWith('/users/@me/guilds')) {
      return { ok: true, json: async () => guilds } as any;
    }
    return { ok: false, json: async () => ({}) } as any;
  });
}
const sqlPresent = (present: boolean) => (async () => (present ? [{ '?column?': 1 }] : [])) as any;

describe('requireGuildAccess', () => {
  it('401 sem token', async () => {
    const r = await requireGuildAccess(ev(), 'g1', { fetchImpl: fakeFetch(null, []), sql: sqlPresent(true) });
    expect(r).toMatchObject({ ok: false, status: 401 });
  });
  it('403 se não é dono', async () => {
    const r = await requireGuildAccess(ev('t'), 'g1',
      { fetchImpl: fakeFetch('u1', [{ id: 'g1', owner: false }]), sql: sqlPresent(true) });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });
  it('403 se bot ausente', async () => {
    const r = await requireGuildAccess(ev('t'), 'g1',
      { fetchImpl: fakeFetch('u1', [{ id: 'g1', owner: true }]), sql: sqlPresent(false) });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });
  it('ok quando dono + bot presente', async () => {
    const r = await requireGuildAccess(ev('t'), 'g1',
      { fetchImpl: fakeFetch('u1', [{ id: 'g1', owner: true }]), sql: sqlPresent(true) });
    expect(r).toMatchObject({ ok: true, userId: 'u1' });
  });
});
```

Run: `npm test -- requireGuildAccess` → FAIL.

- [ ] **Step 2: implementar**

```ts
import { botSql } from './botDb';

export type Access = { ok: true; userId: string } | { ok: false; status: number; error: string };

type Deps = { fetchImpl?: typeof fetch; sql?: (strings: TemplateStringsArray, ...v: any[]) => Promise<any[]> };

function bearer(event: { headers: Record<string, string | undefined> }): string | null {
  const h = event.headers || {};
  const raw = h.authorization || h.Authorization;
  if (!raw || !raw.startsWith('Bearer ')) return null;
  return raw.slice('Bearer '.length);
}

/** owner-first: só o dono da guild, e só se um bot do sistema está presente nela. */
export async function requireGuildAccess(
  event: { headers: Record<string, string | undefined> },
  guildId: string | undefined,
  deps: Deps = {},
): Promise<Access> {
  const doFetch = deps.fetchImpl ?? fetch;
  const sql = deps.sql ?? (botSql as any);

  const token = bearer(event);
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' };
  if (!guildId) return { ok: false, status: 400, error: 'Missing guildId' };

  const me = await doFetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!me.ok) return { ok: false, status: 401, error: 'Invalid token' };
  const userId = (await me.json())?.id as string | undefined;
  if (!userId) return { ok: false, status: 401, error: 'No user id' };

  const gRes = await doFetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!gRes.ok) return { ok: false, status: 502, error: 'Discord guilds fetch failed' };
  const guilds = (await gRes.json()) as Array<{ id: string; owner?: boolean }>;
  const guild = guilds.find((g) => String(g.id) === String(guildId));
  if (!guild || guild.owner !== true) return { ok: false, status: 403, error: 'Not the guild owner' };

  const rows = await sql`SELECT 1 FROM bot_guilds WHERE guild_id = ${guildId} AND bot_present = true`;
  if (!rows || rows.length === 0) return { ok: false, status: 403, error: 'Bot not in this guild' };

  return { ok: true, userId };
}
```

Run: `npm test -- requireGuildAccess` → PASS (4).

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/lib/requireGuildAccess.ts netlify/functions/lib/__tests__/requireGuildAccess.test.ts
git commit -m "feat(dashboard): owner-first + bot-present authz (requireGuildAccess)"
```

---

## Task 3: `lib/guildConfig.ts` (read + merge-write)

**Files:**
- Create: `netlify/functions/lib/guildConfig.ts`
- Test: `netlify/functions/lib/__tests__/guildConfig.test.ts`

**Interfaces:**
- Produces: `getGuildConfigRow(guildId)`; `MAP_COLUMNS`; `ALLOWED_KEYS` por coluna; `sanitizePatch(column, patch)`; `patchMap(guildId, column, patch, updatedBy, sql?)`.

- [ ] **Step 1: teste da parte pura (falha primeiro)**

Create `netlify/functions/lib/__tests__/guildConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sanitizePatch } from '../guildConfig';

describe('sanitizePatch', () => {
  it('mantém só chaves permitidas de channels', () => {
    const out = sanitizePatch('channels', { 'log-mensagens': '1', 'chave-invalida': '2' });
    expect(out).toEqual({ 'log-mensagens': '1' });
  });
  it('mantém só toggles conhecidos', () => {
    const out = sanitizePatch('toggles', { 'sec:automod': true, 'nope': false });
    expect(out).toEqual({ 'sec:automod': true });
  });
  it('rejeita coluna desconhecida', () => {
    expect(() => sanitizePatch('dashboard_access' as any, { users: [] })).toThrow();
  });
});
```

Run: `npm test -- guildConfig` → FAIL.

- [ ] **Step 2: implementar**

```ts
import { botSql } from './botDb';

export const MAP_COLUMNS = ['channels', 'roles', 'toggles', 'settings'] as const;
export type MapColumn = (typeof MAP_COLUMNS)[number];

// Allowlist mínima do contrato (dashboard-config-schema-contract.md §Chaves permitidas).
// Expandir conforme a UI cobrir mais grupos; começa com os principais.
const ALLOWED_KEYS: Record<MapColumn, ReadonlySet<string>> = {
  channels: new Set([
    'log-comandos','log-mensagens','log-entradas','log-saidas','log-membros','log-voz','log-canais',
    'log-cargos','log-servidor','log-bans','log-kicks','log-moderacao','log-formularios','log-loja',
    'log-tickets','event-channel','level-notify','welcome:channel','welcome:farewell-channel',
  ]),
  roles: new Set([
    'moderador','staff','mutado','nao-verificado','vendedor','welcome:autorole',
  ]),
  toggles: new Set([
    'mod:dm-on-action','mod:require-reason','sec:automod','sec:automod-warn','sec:automod-block-invites',
    'sec:verify','sec:antiraid','sec:antinuke','welcome:enabled','welcome:dm','welcome:farewell-enabled',
    'level:enabled','eco:enabled','event:enabled',
  ]),
  settings: new Set([
    'mod:warn-ttl-days','mod:escalation','welcome:message','welcome:image','welcome:farewell-message',
    'level:notify','level:ignored-channels','eco:currency-name','eco:currency-emoji','eco:daily',
    'event:min-interval','event:max-interval',
  ]),
};

/** Devolve só as chaves permitidas do patch para aquela coluna. Lança em coluna desconhecida. */
export function sanitizePatch(column: MapColumn, patch: Record<string, unknown>): Record<string, unknown> {
  const allowed = ALLOWED_KEYS[column];
  if (!allowed) throw new Error(`coluna não editável: ${column}`);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

export async function getGuildConfigRow(guildId: string, sql = botSql) {
  const rows = await sql`
    SELECT guild_id, log_channel_id, ticket_log_channel_id,
           channels, roles, toggles, staff_role_ids, settings, dashboard_access, updated_at
      FROM guild_config WHERE guild_id = ${guildId}`;
  return rows[0] ?? null;
}

/** Merge por chave num mapa JSONB, criando a linha se preciso. Nunca toca dashboard_access. */
export async function patchMap(
  guildId: string, column: MapColumn, patch: Record<string, unknown>, updatedBy: string, sql = botSql,
) {
  const clean = sanitizePatch(column, patch);
  const json = JSON.stringify(clean);
  // Coluna é estática por ramo (tagged templates não parametrizam identificadores).
  switch (column) {
    case 'channels':
      return sql`INSERT INTO guild_config (guild_id, channels, updated_by, updated_at)
                 VALUES (${guildId}, ${json}::jsonb, ${updatedBy}, now())
                 ON CONFLICT (guild_id) DO UPDATE SET
                   channels = coalesce(guild_config.channels,'{}'::jsonb) || ${json}::jsonb,
                   updated_by = ${updatedBy}, updated_at = now()`;
    case 'roles':
      return sql`INSERT INTO guild_config (guild_id, roles, updated_by, updated_at)
                 VALUES (${guildId}, ${json}::jsonb, ${updatedBy}, now())
                 ON CONFLICT (guild_id) DO UPDATE SET
                   roles = coalesce(guild_config.roles,'{}'::jsonb) || ${json}::jsonb,
                   updated_by = ${updatedBy}, updated_at = now()`;
    case 'toggles':
      return sql`INSERT INTO guild_config (guild_id, toggles, updated_by, updated_at)
                 VALUES (${guildId}, ${json}::jsonb, ${updatedBy}, now())
                 ON CONFLICT (guild_id) DO UPDATE SET
                   toggles = coalesce(guild_config.toggles,'{}'::jsonb) || ${json}::jsonb,
                   updated_by = ${updatedBy}, updated_at = now()`;
    case 'settings':
      return sql`INSERT INTO guild_config (guild_id, settings, updated_by, updated_at)
                 VALUES (${guildId}, ${json}::jsonb, ${updatedBy}, now())
                 ON CONFLICT (guild_id) DO UPDATE SET
                   settings = coalesce(guild_config.settings,'{}'::jsonb) || ${json}::jsonb,
                   updated_by = ${updatedBy}, updated_at = now()`;
  }
}
```

> Nota de schema: `patchMap` grava `updated_by`. O `guild_config` do bot já tem `updated_at`; **`updated_by` precisa existir**. Se a coluna não existir no Neon do bot, adicioná-la é um passo do bot (migração `007_updated_by.sql`: `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS updated_by TEXT`). Registrar como dependência (ver "Pré-requisito de schema").

- [ ] **Step 3: rodar e passar**

Run: `npm test -- guildConfig` → PASS (3).

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/lib/guildConfig.ts netlify/functions/lib/__tests__/guildConfig.test.ts
git commit -m "feat(dashboard): guild_config read + merge-by-key writes (allowlisted)"
```

---

## Task 4: Funções `guild-config-get` / `guild-config-set` / `bot-guilds-list`

**Files:**
- Create: `netlify/functions/guild-config-get.ts`, `netlify/functions/guild-config-set.ts`, `netlify/functions/bot-guilds-list.ts`

**Interfaces:**
- Consomem `requireGuildAccess`, `allowedOrigin`, `getGuildConfigRow`, `patchMap`, `botSql`.

- [ ] **Step 1: `guild-config-get.ts`** (GET, guardado)

```ts
import { Handler } from '@netlify/functions';
import { requireGuildAccess } from './lib/requireGuildAccess';
import { getGuildConfigRow } from './lib/guildConfig';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const guildId = event.queryStringParameters?.guildId;
  const access = await requireGuildAccess(event as any, guildId);
  if (!access.ok) return { statusCode: access.status, body: JSON.stringify({ error: access.error }) };
  const row = await getGuildConfigRow(guildId!);
  return { statusCode: 200, body: JSON.stringify({ data: row ?? {} }) };
};
```

- [ ] **Step 2: `guild-config-set.ts`** (POST merge, guardado + Origin)

```ts
import { Handler } from '@netlify/functions';
import { requireGuildAccess } from './lib/requireGuildAccess';
import { allowedOrigin } from './lib/cors';
import { patchMap, MAP_COLUMNS, MapColumn } from './lib/guildConfig';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!allowedOrigin(event as any)) return { statusCode: 403, body: JSON.stringify({ error: 'Bad origin' }) };

  const body = event.body ? JSON.parse(event.body) : {};
  const { guildId, column, patch } = body as { guildId?: string; column?: string; patch?: Record<string, unknown> };
  if (!MAP_COLUMNS.includes(column as MapColumn)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'coluna inválida' }) };
  }
  const access = await requireGuildAccess(event as any, guildId);
  if (!access.ok) return { statusCode: access.status, body: JSON.stringify({ error: access.error }) };

  await patchMap(guildId!, column as MapColumn, patch ?? {}, access.userId);
  return { statusCode: 200, body: JSON.stringify({ message: 'ok' }) };
};
```

- [ ] **Step 3: `bot-guilds-list.ts`** (GET, owner-first + bot_present)

```ts
import { Handler } from '@netlify/functions';
import { botSql } from './lib/botDb';

// Lista as guilds do usuário marcando quais são configuráveis (dono + bot presente).
export const handler: Handler = async (event) => {
  const auth = event.headers.authorization || (event.headers as any).Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  const token = auth.slice('Bearer '.length);

  const res = await fetch('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: 'Discord guilds fetch failed' }) };
  const guilds = (await res.json()) as Array<{ id: string; name: string; owner?: boolean; icon?: string }>;

  const owned = guilds.filter((g) => g.owner === true);
  if (owned.length === 0) return { statusCode: 200, body: JSON.stringify([]) };

  const ids = owned.map((g) => g.id);
  const present = await botSql`SELECT guild_id FROM bot_guilds WHERE bot_present = true AND guild_id = ANY(${ids})`;
  const presentIds = new Set(present.map((r: any) => String(r.guild_id)));

  const out = owned.map((g) => ({ ...g, hasBot: presentIds.has(String(g.id)) }));
  return { statusCode: 200, body: JSON.stringify(out) };
};
```

- [ ] **Step 4: Build/typecheck**

Run: `npm run build` (Vite build também roda o tsc das funções? se não, `npx tsc --noEmit -p tsconfig.json`). Expected: sem erros de tipo nas funções novas.

- [ ] **Step 5: Rodar a suíte**

Run: `npm test` → todos verdes (cors 5 + requireGuildAccess 4 + guildConfig 3 + os testes existentes do site).

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/guild-config-get.ts netlify/functions/guild-config-set.ts netlify/functions/bot-guilds-list.ts
git commit -m "feat(dashboard): guarded config get/set + owner-first guild list (bot Neon)"
```

---

## Pré-requisitos de schema/infra (dependências desta B1)

1. **`BOT_CONFIG_DATABASE_URL`** nas env vars do Netlify (Neon do bot). *(deploy)*
2. **Coluna `guild_config.updated_by`** no Neon do bot - migração no repo do bot (`007_updated_by.sql`: `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS updated_by TEXT`), aplicada via `ApplyPostgresSchema`. *(a `patchMap` grava `updated_by`.)*

## Smoke (após o deploy + env var + coluna)

- `GET /.netlify/functions/guild-config-get?guildId=<uma guild que você é dono e tem o bot>` com `Bearer <seu token>` → 200 com a config. Com uma guild que você não é dono → 403. Sem token → 401.
- `POST /.netlify/functions/guild-config-set` `{guildId, column:"toggles", patch:{"sec:automod":true}}` do domínio oficial → 200; conferir no Neon que `toggles->>'sec:automod'` virou `true` e que **outras chaves + `dashboard_access` continuam**. De `curl` sem Origin → 403.
- `GET /.netlify/functions/bot-guilds-list` → só guilds das quais você é dono, com `hasBot` correto.

## Fora de escopo (próximas fases B2–B4)

- **B2:** CRUDs das 5 tabelas de config migradas + `ticket_categories` + edição de `dashboard_access`.
- **B3:** Frontend (`Dashboard`/`BotConfig`) migrado pras funções novas + selects populados por snapshot; **remover** as funções antigas e o Supabase de config.
- **B4:** Cookie httpOnly no `callback` (tira o token da URL) + validação via snapshot (`lib/validate`) + delegação `dashboard_access` (v2).

## Self-Review

**Cobertura (spec Parte B, fatia de fundação):** conexão Neon do bot → T1; owner-first + bot_present → T2/T4; merge por chave + allowlist + preserva dashboard_access → T3; Origin/CORS → T1/T4; funções guardadas → T4. Cookie/validação-snapshot/CRUDs/frontend → fases seguintes (documentado). ✅
**Placeholders:** nenhum; todo passo traz código. Dependências (env var, coluna `updated_by`) explícitas.
**Consistência:** `Access`/`requireGuildAccess(event, guildId, deps)`, `patchMap(guildId, column, patch, updatedBy, sql?)`, `sanitizePatch(column, patch)`, `MAP_COLUMNS` - usados igual nos testes e nas funções.
