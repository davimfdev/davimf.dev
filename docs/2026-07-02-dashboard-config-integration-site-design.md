# Integração dashboard ↔ bot - Parte B (lado do site): dashboard de config no Neon + segurança - design

**Data:** 2026-07-02 (revisado: modelo 1-bot-por-cliente + snapshots + CSRF)
**Repo:** `davimf.dev` - **Vite/React SPA** com backend via **Netlify Functions**. As functions fazem OAuth, autorização, validação e escrita **server-side** no Neon. (Não é Next.js.)
**Parte A (lado do bot):** `BaseBot/docs/superpowers/specs/2026-07-02-dashboard-config-integration-design.md`.
**Contrato de schema (fonte-verdade):** `BaseBot/docs/superpowers/dashboard-config-schema-contract.md` - tabelas, colunas, chaves JSONB permitidas, enums, merge/delete, ownership. Vale ele em caso de divergência.

## Objetivo

Fazer o dashboard **realmente configurar o bot**, lendo/escrevendo o **mesmo Neon que o bot lê** (`guild_config` + 5 tabelas de config), com **autorização owner-first**, **validação via snapshots** (sem token de bot) e fechando os buracos de segurança atuais.

## Estado atual (2026-07-02)

- **Stack:** Vite/React SPA no Netlify; backend = Netlify Functions (`netlify/functions/*.ts`); rotas `/api/*`.
- **Neon já plugado (banco do site):** 25 functions usam `neon(process.env.DATABASE_URL)` - accounts, tickets, notes… Esse `DATABASE_URL` é o **banco do próprio site** e **não muda**.
- **Identidade já boa:** funções usam `getDiscordId(authHeader)` → `GET /users/@me`.
- **Config do bot ainda no Supabase (stub desconectado):** `getGuildConfig`/`updateGuild`/`getSecurityConfig`/`updateSecurityConfig`/`getGuilds` batem no Supabase (`guilds`, `guild_verificacao`) com schema **≠** do bot → hoje o dashboard **não** afeta o bot.
- **Auth OAuth:** `callback.ts` troca `code` → redireciona pra `/dashboard?token=<access_token>` (token na URL).

### 🔴 Buracos de segurança a fechar
1. **Escrita sem autorização (IDOR):** `updateGuild`/`updateSecurityConfig` só checam que `userToken` **existe** - não verificam dono da `guildId`. Qualquer logado escreve qualquer servidor.
2. **Token do Discord na URL:** `callback.ts` → `/dashboard?token=…` (vaza em histórico/`Referer`/logs).
3. **Autorização ampla demais:** `getGuilds` aceita owner **ou** admin **ou** manage-guild. A decisão é **owner-first**.

## Modelo do produto: 1 bot por cliente

Existe **1 bot por cliente**, cada um com **seu próprio token local**. O dashboard **não conhece nem armazena** tokens de bots. Portanto a validação de canais/cargos/permissões **não** chama a API do Discord com token de bot - usa os **snapshots** que cada bot publica no Neon (`bot_guilds`, `guild_channels_snapshot`, `guild_roles_snapshot`; ver contrato).

## Arquitetura-alvo

```
Navegador ──OAuth──▶ callback (seta sessão httpOnly) ──▶ SPA chama /api/* (credentials)
                                                             │  requireGuildAccess(event, guildId)
                                                             ▼
                        Netlify Function ── owner + bot_present + validação via snapshot ──▶ Neon de config do bot
```

- **Conexão nova e separada:** o Neon de config do bot é projeto **diferente** do banco do site. Nova env var **`BOT_CONFIG_DATABASE_URL`** (`sslmode=require`), com cliente próprio `lib/botDb.ts` → `neon(process.env.BOT_CONFIG_DATABASE_URL)`. Aposenta o Supabase pra config.
- **Autorização central:** `requireGuildAccess(event, guildId)` em **toda** function de config (read **e** write).
- **Validação central via snapshot:** `lib/validate.ts` confere ids/tipo/permissão contra os snapshots.
- **Merge JSONB por chave:** `lib/guildConfig.ts` nunca sobrescreve mapa inteiro.

## 1. Banco: Neon central + menos-privilégio

Modelo **1 bot por cliente** → duas opções de topologia:
- **Recomendado v1 - Neon central de config:** todos os bots escrevem só suas guilds/configs num único Neon; o dashboard usa **um** `BOT_CONFIG_DATABASE_URL`. Separação por cliente via `bot_instance_id`/`guild_id` nas linhas. Simples.
- **Mais isolado (futuro) - Neon por cliente:** o dashboard resolve `guild_id → tenant → connection string`; exige guardar secrets por cliente. Mais complexo; fora da v1.

**Role do dashboard no Neon:** acesso **só** às tabelas de config/snapshot necessárias. Garantir: sem gameplay (nem está no Neon); sem `DROP`/`ALTER`; secrets só server-side.

**Isolamento multi-tenant (Neon central):** cada **bot** escreve só linhas do seu `bot_instance_id` (guard do lado do bot - Parte A + contrato §*Segurança multi-tenant*). Do lado do **dashboard**, o isolamento por-cliente vem do `requireGuildAccess` (§3): só escreve config de guild que o usuário **é dono** e que tem bot presente (`bot_guilds`). A role do dashboard é ampla nas tabelas de config, mas toda rota é gateada por essa autorização.

## 2. Modelo de dados: do Supabase pro `guild_config`

As functions passam a ler/gravar o schema real do bot (contrato). Destaques:
- **`guild_config`**: colunas typed + mapas JSONB `channels`/`roles`/`toggles`/`settings` + `staff_role_ids` + `dashboard_access` + `updated_by`/`updated_at`. Editar = **merge por chave** (§4), nunca sobrescrever o mapa.
- **`ticket_categories`**: CRUD.
- **5 tabelas migradas** (a Parte A cria): `self_roles`(+`self_role_options`), `level_rewards`, `quiz`, `shop_items` (só config; `sold` fica no SQLite do bot), `action_types`. CRUD, com **soft-delete** onde houver histórico (§6).
- **`pix_keys` fica de fora.**

Grupos de UI (inventário): Logs (24 canais), Cargos lógicos, Moderação (`mod:*`), Segurança (`sec:*`), Boas-vindas (`welcome:*`), Nível (`level:*`+`level_rewards`), Economia (`eco:*`+`shop_items`), Eventos (`event:*`), Tickets (`ticket_categories`), Facs (`perm:*`/farm/`action_types`), Auto-cargos (`self_roles`), Quiz (`quiz`).

## 3. Autorização owner-first - `requireGuildAccess(event, guildId)`

Assinatura recebe o **evento/request inteiro** (não só o header) - hoje lê Bearer; amanhã cookie httpOnly; depois sessão própria - **sem reescrever as functions**. Passos:
1. Resolve a identidade do usuário (Bearer → cookie → sessão, nessa ordem de suporte).
2. Valida sessão/token.
3. Busca guilds do usuário: `GET /users/@me/guilds` (scopes `identify + guilds`).
4. **v1:** autoriza só se `guild.owner === true` para `guildId`.
5. **Além disso:** a guild deve existir em `bot_guilds` com `bot_present = true` (senão não há bot pra configurar).
6. Retorna `{ ok, userId, guildId }` ou **401** (sem sessão) / **403** (não dono / sem bot).

> **v1:** só o **dono** de servidor **onde um bot do sistema está instalado**.
> **v2:** o dono delega via `dashboard_access.users` ou `dashboard_access.roles` (cargo exige scope `guilds.members.read` → `GET /users/@me/guilds/{id}/member`).

`getGuilds` passa a marcar configurável só onde `owner === true` **e** existe em `bot_guilds` com `bot_present = true`.

## 4. Merge/patch JSONB (nunca sobrescrever mapa)

`lib/guildConfig.ts`, mapas `channels`/`roles`/`toggles`/`settings`/`dashboard_access`:
```sql
-- setar/atualizar 1 chave
channels = channels || jsonb_build_object($key, $value)
-- patch de várias chaves
channels = channels || $patch::jsonb
-- remover chave
channels = channels - $key
```
`null` **não** é remoção (a não ser que o contrato marque `null` como valor válido). **Allowlist de chaves:** validar contra a lista do contrato antes de gravar - o dashboard **não** grava chave arbitrária em `channels`/`roles`/`toggles`/`settings`. Toda gravação seta `updated_by`/`updated_at`.

## 5. Validação via snapshot (`lib/validate.ts`)

Antes de gravar canal/cargo, validar contra os snapshots (não contra a API do Discord):
- canal existe em `guild_channels_snapshot` daquela guild → senão **400**;
- tipo compatível (ex.: canal de log = texto; recusar voz onde se espera texto) → senão **400**;
- `bot_can_view = true` (e `bot_can_send = true` se o bot for enviar ali) → senão **400**;
- cargo existe em `guild_roles_snapshot` → senão **400**;
- cargo configurável exige `bot_can_assign = true` quando aplicável → senão **400**;
- enums/limites do contrato (`level:notify`, `mod:escalation`, ≤25, números em faixa).

**Frescor (limiares padrão, do contrato - ajustáveis):** snapshot fresco se `updated_at`/`last_seen_at` < **10 min**.
- **Selects no frontend:** mostrar aviso se > **10 min**:
  > As informações de canais/cargos podem estar desatualizadas. O bot precisa estar online para sincronizar.
- **Writes críticos de canal/cargo:** **bloquear** (400/409) se > **15 min**.
- **Toggles/settings** sem dependência de canal/cargo: gravam normalmente, independente do frescor.

## 6. Soft-delete de configs com histórico

`shop_items`, painéis e configs com histórico operacional: preferir `enabled=false` a `DELETE` físico.
- `shop_items`: `sold` fica no SQLite (`shop_stock`); Neon guarda só config; remover no dashboard = `enabled=false`; `shop_purchases` histórico não quebra.
- `self_roles`/painéis: idem `enabled=false`.

## 7. Fixes de segurança

- **Cookie httpOnly (remove token da URL):** `callback.ts` para de redirecionar pra `/dashboard?token=…`; seta sessão em cookie `HttpOnly; Secure; SameSite=Lax` e redireciona pra `/dashboard` limpo.
  - **Curto prazo aceito:** cookie httpOnly contendo o access token do Discord.
  - **Longo prazo recomendado:** sessão própria assinada com `JWT_SECRET` (guarda `discord_id` + expiração; refresh via `refresh.ts` existente); **não** expor o access token do Discord ao frontend.
- **Authz em toda escrita** (§3): mata o IDOR.
- **CSRF/Origin:** toda function mutante (`POST/PUT/PATCH/DELETE`) valida `Origin` e/ou `Referer` - permitir **só** o domínio oficial do dashboard. Revisar CORS: **nada** de `Access-Control-Allow-Origin: *` em rotas autenticadas; permitir só o domínio correto; `credentials` só quando necessário.
- **Validação de entrada** via snapshot (§5).
- **Auditoria:** `updated_by = userId`, `updated_at = now()` em toda gravação.
- **Segredos:** `BOT_CONFIG_DATABASE_URL` e secrets OAuth só server-side; `SUPABASE_SERVICE_KEY` deixa de ser usado por config.

## 8. Functions afetadas

- **Reescrever (Supabase→Neon do bot + `requireGuildAccess` + validação):** `getGuildConfig`, `updateGuild`, `getSecurityConfig`, `updateSecurityConfig`, `getGuilds`.
- **Novas (CRUD):** `ticketCategories`, `selfRoles`, `selfRoleOptions`, `levelRewards`, `quiz`, `shopItems`, `actionTypes`, `dashboardAccess`, e escrita genérica de mapa (`updateGuildConfig` com merge por chave).
- **Novos libs:** `lib/botDb.ts`, `lib/requireGuildAccess.ts`, `lib/guildConfig.ts` (merge por chave), `lib/validate.ts` (snapshot/enums/limites), `lib/cors.ts` (Origin/CORS).
- **`callback.ts`:** cookie httpOnly.

## 9. Frontend (`src/pages/`)

- `LoginPage.tsx`: OAuth scopes `identify + guilds` (+ `guilds.members.read` na v2). Não depender mais do token na query.
- `Dashboard.tsx`: lista guilds; configurável só onde é **dono** e há bot (`bot_present`).
- `BotConfig.tsx`: abas por grupo (§2) + editores das 5 tabelas. **Selects de canal/cargo populados pelos snapshots** (evita digitar id manual). Reusa o padrão de fetch com `credentials`.

## 10. Migração de dados (Supabase → Neon)

Script único (uma vez): pra cada linha de `guilds`/`guild_verificacao` no Supabase, mapear o que fizer sentido pro `guild_config` (ex.: `guild_verificacao.status` → `toggles['sec:verify']`; `prefix`/`cor`/`cargo_entrada` só se o bot usar equivalente). Sem equivalente → não migra (era stub). Depois **aposentar** as tabelas Supabase de config.

## 11. Decomposição (→ planos). *Depende da Parte A ter criado as tabelas/snapshots no Neon.*

1. **Fundação + segurança:** `BOT_CONFIG_DATABASE_URL` + `lib/botDb`, `requireGuildAccess(event,…)`, `lib/guildConfig` (merge), `lib/validate` (snapshot), `lib/cors` (Origin), cookie httpOnly no `callback`. Reescrever as 5 functions pro Neon do bot + authz + `bot_present`. (Fecha os 3 buracos.)
2. **CRUDs:** as 5 tabelas + `ticket_categories` + `dashboard_access`.
3. **Frontend:** abas do `BotConfig` + selects via snapshot.
4. **Migração + retirada do Supabase de config.**

## 12. Testes (vitest)

**Segurança/authz:** sem sessão → 401; logado não-dono → 403; dono → 200; dono de guild **sem bot** (`bot_present=false`/ausente) → não configura; write com `Origin` inválido → 403; read e write ambos passam por `requireGuildAccess`.
**JSONB:** merge não apaga chaves alheias; delete usa `-`; `null` não vira delete acidental; `/setup` preserva `dashboard_access` (coordenar com Parte A).
**Snapshot:** canal inexistente → 400; tipo errado → 400; canal sem permissão do bot → 400; cargo inexistente → 400; cargo não-atribuível → 400; snapshot velho bloqueia crítico ou mostra aviso.
*(Discord API e Neon mockados.)*

## 13. Fora de escopo / abertos

- **Ligar o Neon do bot no site:** criar `BOT_CONFIG_DATABASE_URL` (Neon central de config, projeto separado do banco do site), role de menos-privilégio. Sem isso a Parte B não roda.
- Scope `guilds.members.read` só é preciso pra `dashboard_access` por cargo (v2).
- `pix_keys` e gameplay ficam no SQLite do bot.
- Reescrever a auth geral do site (Google/JWT/etc.) - só a parte do dashboard de config muda.
- Neon-por-cliente (multi-tenant isolado) - futuro.
