# Migração Netlify → VPS (Coolify)

Documento de referência da saída da Netlify. Cobre a arquitetura nova, como
rodar tudo localmente, quais variáveis cadastrar, o que reconfigurar no Discord
e no AbacatePay, e como configurar o Nginx Proxy Manager.

---

## 1. Arquitetura

```
Internet
  │
  └── Nginx Proxy Manager  (TLS, Let's Encrypt, HTTP/2)
        │
        ├── /       ──► davimf-site : 80      container nginx servindo o build do Vite
        │
        └── /api/   ──► davimf-api  : 3000    container Node.js/TypeScript (Express)
```

Frontend e API compartilham o domínio `https://davimf.dev`, então **não há CORS**:
o browser sempre chama `/api/...` na mesma origem da página.

### O que mudou

| Antes (Netlify) | Agora (VPS) |
| --- | --- |
| `netlify/functions/*.ts` executadas como funções serverless | as **mesmas** `netlify/functions/*.ts`, importadas pelo Express em `server/` |
| redirect `/api/* → /.netlify/functions/:splat` | rotas registradas em `server/src/routes/functions.ts` |
| redirect SPA `/* → /index.html` | `try_files $uri $uri/ /index.html` no `nginx.conf` |
| `process.env.URL` injetada pela plataforma | variável `URL` resolvida no arranque por `server/src/utils/env.ts` |
| um banco por variável mágica da Netlify | connection strings cadastradas explicitamente |
| driver HTTP da Neon (`@neondatabase/serverless`, `@netlify/neon`) | **PostgreSQL por TCP com pool** (`postgres.js`), ver abaixo |

**Nenhum arquivo dentro de `netlify/functions/` foi alterado.** O backend adapta
os handlers antigos em vez de reescrevê-los, o que mantém os 126 testes
existentes válidos e o comportamento idêntico.

### Banco: do driver HTTP da Neon para TCP

O driver da Neon fala com o banco por **HTTP** (`fetch` para um endpoint da
Neon). Depois da mudança para o VPS, o Postgres passou a ser um servidor comum
em `postgres:5432` e não existe endpoint HTTP nenhum - daí o erro visto em
produção:

```
NeonDbError: Error connecting to database: fetch failed
  ECONNREFUSED
  em createDashboardSession() ← handleCallback()   (/api/callback)
```

O mesmo atingia `/api/bot-guilds`, `/api/notes`, `/api/tasks`,
`/api/getAccounts` e `/api/getTransactions`.

**Driver escolhido: `postgres.js`.** A API é a mesma template tag que os ~25
handlers já usavam (``await sql`SELECT ...` `` devolve array de linhas), então
nenhuma query precisou ser reescrita. Com `pg` seria preciso converter toda
query para `$1` + `.rows` - diff enorme, inclusive sobre o código financeiro.

Tudo passa por `netlify/functions/lib/db.ts`:

| Acessor | Variáveis (em ordem) | Banco |
| --- | --- | --- |
| `siteDbSql` | `DATABASE_URL` → `NETLIFY_DATABASE_URL` | `davimf_dev` |
| `authDbSql` | `NETLIFY_DATABASE_URL` → `DATABASE_URL` | `davimf_dev` |
| `botDbSql` | `POSTGRES_URL` → `BOT_CONFIG_DATABASE_URL` | `bot_configs` |
| `ticketsDbSql` | `TICKETS_NEON` → `TICKETS_DATABASE_URL` | tickets |

`siteDbSql` e `authDbSql` existem separados de propósito: os handlers antigos
liam variáveis diferentes para o mesmo banco. Apontando as duas para a mesma
URL - o caso normal - o **pool é o mesmo objeto**; apontando para bancos
diferentes, cada handler continua indo aonde os dados dele estão. Unificar as
duas listas poderia fazer tabela "sumir".

**Um pool por connection string.** Vários handlers criavam o cliente *dentro*
do handler (`const sql = neon(...)`). Com HTTP isso era grátis; com TCP,
criar um cliente por requisição vazaria conexões até esgotar o
`max_connections`. Os clientes são memoizados pela connection string, e
`closeAllPools()` é chamado no `SIGTERM`/`SIGINT`.

**Compatibilidade de comportamento** (o que foi conferido antes de trocar):

- `transform: { undefined: null }` - o driver antigo (via `pg`) mandava
  `undefined` como NULL; sem essa opção o `postgres.js` lança
  `UNDEFINED_VALUE`, e handlers que interpolam campos crus do corpo da
  requisição (`accounts.ts`) quebrariam;
- os parsers padrão coincidem: `int8`/`numeric` → string, `jsonb` → objeto,
  `timestamptz` → `Date`, `bool` → boolean;
- arrays em `= ANY(${...})` e `text[]` continuam funcionando nativamente;
- o erro de env var ausente continua sendo **síncrono**, como antes.

Ajustes de pool por ambiente: `DB_POOL_MAX` (10), `DB_IDLE_TIMEOUT` (30),
`DB_CONNECT_TIMEOUT` (10), `DB_MAX_LIFETIME` (1800), `DB_LOG_NOTICES`. Atrás de
PgBouncer em modo `transaction`, desligue prepared statements com
`DB_PREPARE=false` ou `PGBOUNCER=true`.

### Configuração de ambiente no arranque

`server/src/index.ts` executa, nesta ordem:

1. **`loadEnvFileIfPresent()`** - procura um `.env` subindo até 4 níveis a
   partir do CWD (e, se preciso, do diretório do módulo). Antes, só
   `npm run dev` lia o arquivo, via `tsx --env-file-if-exists=../.env`;
   `npm start` e o `CMD` do Docker não liam nada, então uma variável definida
   **apenas** no `.env` sumia fora do modo dev. `process.loadEnvFile` não
   sobrescreve o que já existe no ambiente, então **a env da plataforma continua
   ganhando do arquivo**. Na imagem Docker o `.env` é excluído de propósito
   (`.dockerignore`) e a função vira no-op. `ENV_FILE=/caminho/para/.env`
   força um arquivo específico.

2. **`applyCompatibilityEnv()`** - resolve a URL pública e grava o valor
   normalizado em `process.env.URL`, que é o nome lido por `shorten`,
   `abacate-checkout` e pelo módulo de pagamentos. Ordem de precedência:

   `URL` › `PUBLIC_SITE_URL` › `SITE_URL` › `APP_URL` › `COOLIFY_URL` ›
   `COOLIFY_FQDN` › `SERVICE_FQDN_*`

   A normalização acrescenta `https://` quando a plataforma expõe só o host
   (é o caso dos `SERVICE_FQDN_*` do Coolify) e remove a barra final - os
   consumidores concatenam direto (`${URL}/r/${code}`), então
   `https://davimf.dev/` geraria `//r/...`.

   **O domínio não está embutido no código**: sai sempre do ambiente. Um valor
   presente porém inválido é descartado, para não propagar link quebrado.

3. **`warnMissingEnv()`** - separa obrigatórias de opcionais. `ABACATEPAY_KEY`
   (checkout legado) e `PAYMENTS_PROVIDER`/`PAYMENTS_ENV` (têm padrão no
   código) saíram da lista de ausentes e viraram uma linha informativa.

O boot imprime de onde a configuração veio:

```
[api] configuração: .env em /app/.env; URL pública = https://davimf.dev
```

### Como a compatibilidade funciona

O projeto tinha dois estilos de handler misturados. `server/src/utils/` traduz
os dois para `req`/`res` do Express:

| Estilo antigo | Arquivo do shim | Tradução |
| --- | --- | --- |
| `export const handler: Handler` (`event`/`context` → `{statusCode, headers, body}`) | `netlifyAdapter.ts` | monta `event.httpMethod`, `event.headers`, `event.body`, `event.queryStringParameters`, `event.rawUrl`; aplica `statusCode`, `headers`, `multiValueHeaders`, `Set-Cookie` e `isBase64Encoded` na resposta |
| `export default (req: Request) => Response` (Web API) | `webAdapter.ts` | monta um `Request` global com URL absoluta, headers e corpo; devolve `status`, headers e **múltiplos `Set-Cookie`** via `getSetCookie()` |

Dois detalhes que sustentam o resto:

- **O corpo nunca é desserializado pelo Express.** O middleware é
  `express.raw({ type: () => true })`, então cada handler continua fazendo o
  próprio `JSON.parse(event.body)` / `await req.json()`. Além de preservar o
  comportamento, isso mantém o corpo íntegro byte a byte - é o pré-requisito
  para validar assinatura de webhook, caso um dia entre algum.
- **`app.set('trust proxy', true)`.** Atrás do Nginx Proxy Manager o backend
  recebe `http://davimf-api:3000`, mas os handlers precisam enxergar
  `https://davimf.dev/...` para montar links curtos e marcar cookies como
  `Secure`. O `X-Forwarded-Proto` resolve isso.

Os módulos são carregados **sob demanda** (`await import()` dentro da rota).
Várias funções abrem conexão com o Neon no escopo do módulo; o carregamento
tardio preserva o isolamento serverless - uma env var ausente derruba só aquele
endpoint, não o servidor inteiro.

---

## 2. Inventário das funções migradas

44 funções. Todas continuam acessíveis nas **mesmas URLs** de antes.

> `Auth` - `discord`: `Authorization: Bearer <access token do Discord>`;
> `cookie`: cookie de sessão `bot_dashboard_session`; `jwt`: `JWT_SECRET` próprio;
> `segredo`: header dedicado; `hmac`: assinatura HMAC-SHA256; `-`: público.

### Dashboard do bot / Discord OAuth

| Função | Endpoint | Métodos | Auth | Env | Observações |
| --- | --- | --- | --- | --- | --- |
| `dashboard-login` | `/api/dashboard-login` | GET | - | `DISCORD_CLIENT_ID`, `DISCORD_REDIRECT_URI`, `DASHBOARD_SESSION_SECRET` | **302** para o Discord. Grava cookie `bot_dashboard_oauth_state` (`HttpOnly`, `SameSite=Lax`, `Path=/api/callback`, 600s). `Secure` só quando o Host não é localhost. Aceita `?returnTo=` |
| `callback` | `/api/callback` | GET | - | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `DASHBOARD_SESSION_SECRET`, `DASHBOARD_TOKEN_ENCRYPTION_KEY`, `NETLIFY_DATABASE_URL` | **302** para `returnTo`. Emite **dois** `Set-Cookie` (limpa o state + grava a sessão, 7 dias). Fora de `/dashboard*`, devolve o token do Discord na querystring (auth legada das outras páginas) |
| `dashboard-session` | `/api/dashboard-session` | GET | cookie | sessão + `NETLIFY_DATABASE_URL` | Renova o token do Discord automaticamente quando falta <2min |
| `dashboard-logout` | `/api/dashboard-logout` | POST | cookie | `NETLIFY_DATABASE_URL`, `NODE_ENV` | Revoga a sessão e expira o cookie |
| `bot-guilds` | `/api/bot-guilds` | GET | cookie | `BOT_CONFIG_DATABASE_URL`, `BOT_SUPPORT_USER_IDS` | |
| `bot-guilds-list` | `/api/bot-guilds-list` | GET | discord | `BOT_CONFIG_DATABASE_URL` | |
| `bot-config-get` | `/api/bot-config-get` | GET | cookie | `BOT_CONFIG_DATABASE_URL` | |
| `bot-config-patch` | `/api/bot-config-patch` | PATCH | cookie | `BOT_CONFIG_DATABASE_URL` | Checa `Origin`/`Referer` contra allowlist antes da auth |
| `bot-config-access` | `/api/bot-config-access` | GET, PATCH | cookie | `BOT_CONFIG_DATABASE_URL` | idem |
| `bot-config-collection` | `/api/bot-config-collection` | GET, POST, PATCH, DELETE | cookie | `BOT_CONFIG_DATABASE_URL` | idem |
| `guild-config-get` | `/api/guild-config-get` | GET | discord | `BOT_CONFIG_DATABASE_URL` | rota legada (owner-first) |
| `guild-config-set` | `/api/guild-config-set` | POST | discord | `BOT_CONFIG_DATABASE_URL` | idem |

### Produtividade (token do Discord)

| Função | Endpoint | Métodos | Auth | Env |
| --- | --- | --- | --- | --- |
| `tasks` | `/api/tasks` | GET, POST, PUT, DELETE | discord | `DATABASE_URL` |
| `notes` | `/api/notes` | GET, POST, PUT, DELETE | discord | `DATABASE_URL` |
| `accounts` | `/api/accounts` | GET, POST, DELETE | discord | `DATABASE_URL` |
| `getAccounts` | `/api/getAccounts` | GET, POST, DELETE | discord | `DATABASE_URL` |
| `getTransactions` | `/api/getTransactions` | GET, POST, DELETE | discord | `DATABASE_URL` |
| `getUserUrls` | `/api/getUserUrls` | GET | discord | `DATABASE_URL` |
| `getmyurls` | `/api/getmyurls` | GET | discord | `DATABASE_URL` |
| `create-short-url` | `/api/create-short-url` | POST | discord (opcional) | `DATABASE_URL` |
| `deleteUrl` | `/api/deleteUrl`, `/api/deleteurl`, `/api/delete-url` | DELETE | discord | `DATABASE_URL` |
| `get-url` | `/api/get-url` | GET | - | `DATABASE_URL` |
| `shorten` | `/api/shorten` | POST | - | `DATABASE_URL`, `URL` |

### Auth JWT legada

| Função | Endpoint | Métodos | Auth | Env | Observações |
| --- | --- | --- | --- | --- | --- |
| `register` | `/api/register` | POST | - | `NETLIFY_DATABASE_URL` | bcrypt |
| `refresh` | `/api/refresh` | POST | cookie `refresh_token` | `NETLIFY_DATABASE_URL`, `JWT_SECRET` | |
| `logout` | `/api/logout` | POST | jwt | `NETLIFY_DATABASE_URL`, `JWT_SECRET`, `NODE_ENV` | expira `refresh_token` |
| `request-password-reset` | `/api/request-password-reset` | POST | - | `NETLIFY_DATABASE_URL` | envio de e-mail está **comentado** no código |
| `reset-password` | `/api/reset-password` | POST | - | `NETLIFY_DATABASE_URL` | |
| `expenses` | `/api/expenses` | GET, POST, DELETE | jwt | `NETLIFY_DATABASE_URL`, `JWT_SECRET` | |
| `transactions` | `/api/transactions` | GET, POST, DELETE | jwt | `NETLIFY_DATABASE_URL`, `JWT_SECRET` | checa blacklist de `jti` |
| `transfer` | `/api/transfer` | POST | jwt | `NETLIFY_DATABASE_URL`, `JWT_SECRET` | |
| `exchange-rates` | `/api/exchange-rates` | GET | jwt | `JWT_SECRET`, `EXCHANGERATE_API_KEY` | proxy para exchangerate-api.com |

### Licenças FMM e pagamentos

| Função | Endpoint | Métodos | Auth | Env | Observações |
| --- | --- | --- | --- | --- | --- |
| `fmm-activate` | `/api/fmm-activate` | POST | hmac | `NETLIFY_DATABASE_URL`, `FMM_APP_SECRET` | janela de ±10min no timestamp |
| `fmm-validate` | `/api/fmm-validate` | POST | hmac | `NETLIFY_DATABASE_URL`, `FMM_APP_SECRET` | idem |
| `fmm-generate` | `/api/fmm-generate` | POST | segredo `x-admin-secret` | `NETLIFY_DATABASE_URL`, `FMM_ADMIN_SECRET` | comparação `timingSafeEqual` |
| `fmm-keys` | `/api/fmm-keys` | POST | segredo `x-admin-secret` | `NETLIFY_DATABASE_URL`, `FMM_ADMIN_SECRET` | |
| `fmm-revoke` | `/api/fmm-revoke` | POST | segredo `x-admin-secret` | `NETLIFY_DATABASE_URL`, `FMM_ADMIN_SECRET` | |
| `fmm-admin-keys` | `/api/fmm-admin-keys` | GET, POST | discord (allowlist de IDs no código) | `NETLIFY_DATABASE_URL` | |
| `fmm-admin-generate` | `/api/fmm-admin-generate` | POST | discord (allowlist de IDs no código) | `NETLIFY_DATABASE_URL` | |
| `fmm-my-keys` | `/api/fmm-my-keys` | GET | discord | `NETLIFY_DATABASE_URL` | |
| `abacate-checkout` | `/api/abacate-checkout` | POST | - | `ABACATEPAY_KEY`, `FMM_*_PRODUCT_ID`, `URL`, `NETLIFY_DATABASE_URL` | cria checkout, grava `fmm_orders` |
| `fmm-claim` | `/api/fmm-claim` | GET | discord (opcional) | `ABACATEPAY_KEY`, `NETLIFY_DATABASE_URL` | **confirma pagamento por polling**, não por webhook |

### Tickets

| Função | Endpoint | Métodos | Auth | Env |
| --- | --- | --- | --- | --- |
| `ticket-get` | `/api/ticket`, `/api/ticket-get` | GET | - (payload é cifrado) | `TICKETS_NEON` |
| `ticket-store` | `/api/ticket-store` | POST | segredo `x-ticket-secret` | `TICKETS_NEON`, `TICKET_INGEST_SECRET` |

### Rotas novas do backend

| Endpoint | Descrição |
| --- | --- |
| `GET /health` | healthcheck do container. Sem auth. `200 {"status":"ok"}` |
| `GET /api/health` | mesmo healthcheck, alcançável pelo proxy público |
| `GET /api/_routes` | lista as rotas registradas (diagnóstico) |

### Stripe e webhooks

**Não existe integração Stripe neste projeto** - a busca por `stripe` em `src/`,
`netlify/` e `package.json` não retorna nada. O gateway é o **AbacatePay**, e a
confirmação de pagamento é feita por **polling** em `fmm-claim` (`GET
/checkouts/list`), não por webhook. Portanto **não há nenhum endpoint que exija
corpo cru para validar assinatura**.

Mesmo assim o backend já lê o corpo como `Buffer` cru e nunca faz `JSON.parse`
antes do handler - se um webhook assinado entrar depois (AbacatePay ou Stripe),
a verificação de assinatura funciona sem mudar a infraestrutura.

---

## 3. Rodando localmente

Pré-requisitos: Node 22+ (o script `dev` do backend usa `--env-file-if-exists`).

### 3.1 Configurar o `.env`

```bash
cp .env.example .env
```

Preencha os valores. O mesmo `.env` serve para o frontend e para o backend em
desenvolvimento.

### 3.2 Backend

```bash
cd server
npm install
npm run dev        # http://localhost:3000  (carrega ../.env)
```

Verificação rápida:

```bash
curl http://localhost:3000/health          # {"status":"ok"}
curl http://localhost:3000/api/_routes     # lista as 44 funções
```

### 3.3 Frontend

Em outro terminal, na raiz:

```bash
npm install
npm run dev        # http://localhost:5173
```

O dev server do Vite faz proxy de `/api` para `http://localhost:3000`
(`vite.config.ts`). Isso mantém tudo **same-origin** no desenvolvimento, do
mesmo jeito que em produção - sem CORS e sem `localhost` hardcoded no código.

Para apontar para outro backend:

```bash
VITE_DEV_API_PROXY=http://192.168.0.10:3000 npm run dev
```

### 3.4 Testes e build

```bash
# raiz
npm test                     # 126 testes (vitest)
npm run typecheck:functions  # tsc das Netlify Functions
npm run build                # build de produção do Vite -> dist/

# server/
npm run typecheck
npm run build                # tsc -> server/dist/
npm start                    # roda o build
```

### 3.5 Testando a imagem Docker localmente

O contexto de build é a **raiz do repositório**:

```bash
docker build -f server/Dockerfile -t davimf-api .
docker run --rm -p 3000:3000 --env-file .env davimf-api
curl http://localhost:3000/health
```

Não há `docker-compose` no repositório: em desenvolvimento os dois `npm run dev`
acima cobrem o caso, e em produção quem orquestra é o Coolify.

---

## 4. Variáveis de ambiente

A lista completa e comentada está em [`.env.example`](../.env.example). Resumo
do que precisa ser cadastrado em cada recurso do Coolify:

### Frontend (`davimf-site`)

Nenhuma variável é obrigatória. Só variáveis `VITE_*` chegam ao bundle - e
**qualquer `VITE_*` é pública**, visível para qualquer visitante. Nunca coloque
segredo com esse prefixo.

### Backend (`davimf-api`)

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `NODE_ENV=production` | sim | flag `Secure` dos cookies e obrigatoriedade de `BOT_SUPPORT_USER_IDS` |
| `PORT=3000` | sim | porta do container |
| `URL=https://davimf.dev` | sim | `completionUrl` do AbacatePay e base dos links curtos (era injetada pela Netlify) |
| `DATABASE_URL` | sim | banco do site (urls, tasks, notes, accounts, transactions) |
| `NETLIFY_DATABASE_URL` | sim | users/JWT, expenses, transactions, `dashboard_sessions`, licenças FMM |
| `BOT_CONFIG_DATABASE_URL` | sim | banco de configuração do bot |
| `TICKETS_NEON` | sim | banco de tickets |
| `DISCORD_CLIENT_ID` | sim | OAuth |
| `DISCORD_CLIENT_SECRET` | sim | OAuth |
| `DISCORD_REDIRECT_URI=https://davimf.dev/api/callback` | sim | OAuth |
| `DASHBOARD_SESSION_SECRET` | sim | ≥32 bytes; assina cookie de sessão e state |
| `DASHBOARD_TOKEN_ENCRYPTION_KEY` | sim | exatos 32 bytes em base64 (AES-256-GCM) |
| `BOT_SUPPORT_USER_IDS` | sim em produção | IDs Discord separados por vírgula |
| `JWT_SECRET` | sim | auth legada |
| `FMM_APP_SECRET` | sim | HMAC das licenças |
| `FMM_ADMIN_SECRET` | sim | header `x-admin-secret` |
| `ABACATEPAY_KEY` | sim | pagamentos |
| `FMM_BASIC_MONTHLY_PRODUCT_ID` … `FMM_PRO_LIFETIME_PRODUCT_ID` | sim | 6 IDs de produto do AbacatePay |
| `TICKET_INGEST_SECRET` | sim | header `x-ticket-secret` |
| `EXCHANGERATE_API_KEY` | sim | cotações |
| `HOST` | não | padrão `0.0.0.0` |
| `BODY_LIMIT` | não | padrão `5mb` |
| `CORS_ALLOWED_ORIGINS` | não | deixe **vazio**; mesma origem não precisa de CORS |
| `PUBLIC_SITE_URL` | não | apelido de `URL` |
| `RESEND_API_KEY` | não | só se reativar o envio de e-mail |

Gerando os segredos do dashboard:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # DASHBOARD_SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"     # DASHBOARD_TOKEN_ENCRYPTION_KEY
```

> Reaproveite os valores que já estavam na Netlify em vez de gerar novos:
> trocar `DASHBOARD_TOKEN_ENCRYPTION_KEY` invalida todas as sessões ativas do
> dashboard, e trocar `FMM_APP_SECRET` quebra os clientes desktop já instalados.

---

## 5. Deploy no Coolify

### 5.1 Frontend - `davimf-site`

| Campo | Valor |
| --- | --- |
| Build Pack | Nixpacks |
| Tipo | Static Site |
| Base Directory | `/` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Publish Directory | `/dist` |
| Port | `80` |
| Network Alias | `davimf-site` |
| Custom Nginx Configuration | conteúdo de [`nginx.conf`](../nginx.conf) |

O SPA fallback (`try_files $uri $uri/ /index.html`) é **obrigatório** - sem ele,
recarregar `/dashboard`, `/todo` ou `/r/<code>` devolve 404.

### 5.2 Backend - `davimf-api`

| Campo | Valor |
| --- | --- |
| Build Pack | Dockerfile |
| Base Directory | `/` (o contexto precisa incluir `netlify/`) |
| Dockerfile Location | `/server/Dockerfile` |
| Port (Ports Exposes) | `3000` |
| Network Alias | `davimf-api` |
| Health Check Path | `/health` |
| Variáveis | tabela da seção 4 |

Os dois recursos precisam estar na **mesma rede Docker** do Nginx Proxy Manager
para que os aliases `davimf-site` e `davimf-api` resolvam.

---

## 6. Nginx Proxy Manager

```
Proxy Host:
Domain:
davimf.dev

Frontend:
/
-> davimf-site:80

Custom Location:
/api/
-> davimf-api:3000

Scheme:
http

SSL:
Let's Encrypt
Force SSL
HTTP/2
```

Passo a passo na interface:

1. **Hosts → Proxy Hosts → Add Proxy Host**
2. Aba **Details**
   - Domain Names: `davimf.dev` (adicione `www.davimf.dev` se usar)
   - Scheme: `http`
   - Forward Hostname / IP: `davimf-site`
   - Forward Port: `80`
   - Websockets Support: ligado
   - Block Common Exploits: ligado
3. Aba **Custom locations → Add location**
   - Define location: `/api/`
   - Scheme: `http`
   - Forward Hostname / IP: `davimf-api`
   - Forward Port: `3000`
4. Aba **SSL**
   - SSL Certificate: `Request a new SSL Certificate` (Let's Encrypt)
   - Force SSL: ligado
   - HTTP/2 Support: ligado
   - HSTS: opcional
5. **Save**

O backend recebe o caminho **completo**, começando com `/api/` - é assim que as
rotas estão registradas. Não configure `strip prefix` nem `proxy_pass` com URI
final; isso quebraria todos os endpoints.

Se a aba **Advanced** da custom location estiver disponível, vale garantir os
cabeçalhos de origem (o `trust proxy` do Express depende deles):

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

---

## 7. Serviços externos a reconfigurar

### 7.1 Discord Developer Portal

`Applications → <seu app> → OAuth2 → Redirects`. Precisa conter **exatamente**:

```
https://davimf.dev/api/callback
```

Para desenvolvimento local, adicione também:

```
http://localhost:5173/api/callback
```

> A antiga `http://localhost:8888/api/callback` era a porta do `netlify dev` e
> pode ser removida.

O valor de `DISCORD_REDIRECT_URI` no backend precisa bater **caractere por
caractere** com a URL registrada. Escopos usados: `identify guilds
guilds.members.read`.

### 7.2 AbacatePay

Não há webhook para cadastrar - a confirmação é por polling. O que muda é a
`completionUrl`, montada a partir de `URL`:

```
https://davimf.dev/fmm-activated?ref=<uuid>
```

Basta cadastrar `URL=https://davimf.dev` no backend. Se o painel do AbacatePay
tiver allowlist de domínios de retorno, confirme que `davimf.dev` está lá.

### 7.3 Stripe

Nada a fazer: **o projeto não usa Stripe**. Se um dia entrar, o webhook deve ser
registrado em `https://davimf.dev/api/<nome-do-endpoint>` e o corpo cru já está
disponível (`express.raw`), sem `JSON.parse` prévio.

### 7.4 Mercado Pago - perfil e webhook

Antes do deploy, aplique `db/006_payer_profiles.sql` no mesmo banco usado pela
API. Gere uma única chave de 32 bytes em base64 e configure-a como
`PAYMENTS_PAYER_ENCRYPTION_KEY`. Ela é opcional para cobrar, mas obrigatória
para persistir o perfil de cobrança. Guarde-a em backup seguro: perdê-la impede
descriptografar os perfis existentes; nunca gere uma substituta no boot.

No painel do Mercado Pago, cadastre manualmente:

```text
https://davimf.dev/api/payments/webhooks/mercadopago
```

Selecione **Order (Mercado Pago)** e preserve os demais eventos definidos para
o projeto (planos/assinaturas, fraude, reclamações e contestações, conforme
disponibilidade da conta). Publique o segredo como
`MERCADOPAGO_WEBHOOK_SECRET`, reinicie a API, execute a simulação do painel e
refaça a medição de qualidade da integração.

### 7.5 Bot do Discord (ingestão de tickets)

O bot que envia tickets precisa apontar para
`https://davimf.dev/api/ticket-store` com o header `x-ticket-secret`. A URL não
mudou; confirme apenas se ele usava a URL `*.netlify.app` em vez do domínio.

---

## 8. Troubleshooting

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `/api/*` devolve 404 com HTML | a custom location `/api/` não existe no proxy, e o pedido caiu no frontend | conferir seção 6 |
| `/api/*` devolve 404 **JSON** (`{"error":{"code":"NOT_FOUND"}}`) | a requisição chegou no backend, mas a rota não existe | conferir `GET /api/_routes` |
| Recarregar `/dashboard` dá 404 | falta o SPA fallback | aplicar o `nginx.conf` no `davimf-site` |
| Login do Discord: "Invalid OAuth callback" (400) | cookie de state ausente ou expirado (>10 min), ou `Path` do cookie divergente | refazer o login; conferir se o proxy preserva cookies e se a URL é exatamente `/api/callback` |
| Discord: `invalid_redirect_uri` | `DISCORD_REDIRECT_URI` ≠ Redirect cadastrada | igualar os dois, incluindo esquema e barra final |
| Login funciona, mas a sessão não persiste | cookie sem `Secure` sobre HTTPS, ou `X-Forwarded-Proto` não repassado | garantir Force SSL no proxy e os `proxy_set_header` da seção 6 |
| `SESSION_INVALID` logo depois de logar | `DASHBOARD_SESSION_SECRET` ou `DASHBOARD_TOKEN_ENCRYPTION_KEY` diferentes dos da Netlify | restaurar os valores originais (ou aceitar que todos precisam relogar) |
| Um endpoint específico devolve 500 e o log mostra `Failed to instantiate Neon client` | connection string daquele banco não cadastrada | conferir `DATABASE_URL`, `NETLIFY_DATABASE_URL`, `BOT_CONFIG_DATABASE_URL`, `TICKETS_NEON` |
| No boot o log lista variáveis ausentes | configuração incompleta | é só aviso: o servidor sobe e cada endpoint afetado responde erro |
| `BAD_ORIGIN` (403) em PATCH/POST do dashboard | `Origin`/`Referer` fora da allowlist de `netlify/functions/lib/cors.ts` (`https://davimf.dev`, `http://localhost:5173`, `http://localhost:8888`) | acessar pelo domínio oficial |
| Link curto gerado com host errado | `Host` não repassado pelo proxy | conferir `proxy_set_header Host $host` |
| `completionUrl` do checkout aponta para `localhost:8888` | `URL` não cadastrada no backend | cadastrar `URL=https://davimf.dev` |
| Healthcheck do container falhando | app não subiu | `docker logs` do `davimf-api`; testar `curl http://127.0.0.1:3000/health` dentro do container |

---

## 9. Pendências conhecidas (anteriores à migração)

Encontradas durante a auditoria. **Já estavam quebradas na Netlify** e foram
deixadas como estavam para não misturar correção de produto com migração.

1. **`/api/login` não existe.** `src/pages/LoginPage.tsx` e
   `src/pages/RegisterPage.tsx` chamam `POST /api/login`, mas
   `netlify/functions/login.ts` foi removida no commit `f26d6a5` ("Revamped the
   login system, changed for discord auth"). O login por e-mail/senha está
   inoperante desde então - só o `/api/register` sobrevive.

2. **`src/components/Navbar.tsx` monta a URL do OAuth sem `state`.** O
   `/api/callback` exige o par state-querystring/state-cookie e responde 400 sem
   ele. O componente **não está montado em `App.tsx`** (código morto), então isso
   não afeta a produção. O caminho correto é o de `Layout.tsx`:
   `/api/dashboard-login?returnTo=...`.

3. **`src/pages/Test.tsx`** (rota `/test`) tem `client_id` hardcoded e o mesmo
   problema de `state` - é página de rascunho.

O único desses pontos que foi mexido: `/api/delete-url`. O `UrlShortener.tsx`
sempre chamou esse caminho, enquanto `deleteUrl.ts` declarava
`path: "/api/deleteurl"` - 404 garantido. O backend novo registra os dois (mais
`/api/deleteUrl`), o que restaura o botão de excluir link sem tocar no handler.

---

## 10. Estado da Netlify

`netlify.toml` e `netlify/toml.toml` continuam no repositório, mas **o projeto
não depende mais deles**:

- nenhuma chamada de produção usa `/.netlify/functions/*` (as 13 que existiam
  foram migradas para `/api/*`);
- o redirect `/api/* → /.netlify/functions/:splat` foi substituído pelas rotas
  do Express;
- o redirect SPA foi substituído pelo `nginx.conf`.

`public/_redirects` também é inofensivo: o nginx não o interpreta.

Podem ser removidos quando você tiver certeza de que não vai voltar. O diretório
`netlify/functions/` **não** pode ser removido - é onde os handlers vivem e de
onde o backend os importa.
