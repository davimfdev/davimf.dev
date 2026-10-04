# $elfControl na VPS

O `$elfControl` (app de finanças pessoais: web, desktop e Android) usa este repositório como API.
O frontend mora em outro repositório (`$elfControl`, monorepo pnpm). Aqui ficam só as rotas
`/api/elf/*`, as migrations e esta documentação.

## Topologia

```
Internet
  └── Nginx Proxy Manager (TLS)
        ├── davimf.dev          /         ─► davimf-site     : 80    (inalterado)
        │                       /api/     ─► davimf-api      : 3000  (inalterado)
        └── elf.davimf.dev      /         ─► elfcontrol-web  : 80    nginx com o build do app
                                /api/elf/ ─► davimf-api      : 3000  o MESMO container da API
```

- O app web chama `/api/elf/...` no próprio host `elf.davimf.dev`. Para o navegador é
  same-origin: o cookie de sessão é first-party e `SameSite=Lax` basta.
- Em `elf.davimf.dev` encaminhe **só** `/api/elf/`. Encaminhar `/api/` inteiro exporia as
  rotas do site num segundo host.
- Desktop e Android (Tauri) chamam `https://elf.davimf.dev/api/elf` direto, com
  `Authorization: Bearer`. Por isso as origens do Tauri entram em `ELF_APP_ORIGINS`.
- As rotas também respondem em `davimf.dev/api/elf/*`, porque o container é o mesmo. Isso é
  inofensivo, já que o redirect do OAuth é fixo em `elf.davimf.dev`, mas o app não deve usar esse caminho.

## Código

| Caminho | O quê |
|---|---|
| `netlify/functions/elf/` | Handlers no formato Web API (`export default (req) => Response`) |
| `netlify/functions/elf/lib/` | Sessão, cripto, HTTP/CORS, banco, dispositivo, seed, dinheiro |
| `server/src/routes/functions.ts` | Registro explícito das rotas `elf-*` no Express |
| `db/elf/` | Migrations SQL numeradas do banco `selfcontrol` |
| `server/scripts/elf-migrate.mjs` | Aplica as migrations pendentes, registrando em `elf_migrations` |

Spec e planos: `docs/superpowers/` no repositório `$elfControl`.

### Rotas

| Rota | Descrição |
|---|---|
| `GET /api/elf/health` | 200 com o banco ok, 503 se o banco cair |
| `GET /api/elf/auth/start?returnTo=/caminho` | Redireciona para o Discord (escopo `identify`) |
| `GET /api/elf/auth/callback` | Cria usuário, dispositivo web e sessão numa transação; seta `elf_session` e `elf_device` |
| `GET /api/elf/auth/me` | Usuário e sessão atuais (cookie ou Bearer) |
| `POST /api/elf/auth/logout` | Revoga a sessão no servidor |
| `POST /api/elf/auth/device/start` | Público. O app (desktop/Android) pede um código; devolve `code`, `pollToken`, `verificationUrl` |
| `POST /api/elf/auth/device/approve` | Logado na web, aprova o `code` mostrado no app. Cria dispositivo e sessão |
| `POST /api/elf/auth/device/poll` | O app coleta a sessão com o `pollToken`: 428 pendente, 200 uma vez, 409 depois |
| `GET /api/elf/auth/sessions` · `DELETE …/sessions/:id` | Lista e revoga sessões |
| `GET /api/elf/auth/devices` · `DELETE …/devices/:id` | Lista e revoga dispositivos; revogar derruba todas as sessões dele |

### Rate limit e IP do cliente

O rate limit por IP (`auth/start`, `device/start`) lê `X-Real-IP`, que o Nginx Proxy Manager
**sobrescreve** com o IP real. `X-Forwarded-For` nunca é usado. Isso só é seguro enquanto a
porta 3000 do `davimf-api` **não** estiver publicada no host: quem falasse direto com a API
poderia escolher o próprio `X-Real-IP`. Confira com `docker port "$API"` (saída vazia é o certo).

## Banco

Banco **próprio** no mesmo Postgres 17 da VPS. Nunca reutilize `davimf_dev`: `ELF_DATABASE_URL`
não tem nome alternativo e não cai para `DATABASE_URL` de propósito.

Criação (uma vez, via SSH na VPS). O superusuário do Postgres do Coolify **não** se chama
`postgres`: leia o nome em `POSTGRES_USER` do container.

```bash
PG=$(docker ps --format '{{.Names}}\t{{.Image}}' | grep -i postgres | cut -f1 | head -1)
PGU=$(docker exec "$PG" printenv POSTGRES_USER)
SENHA=$(openssl rand -hex 24); echo "$SENHA"
docker exec -i "$PG" psql -U "$PGU" -d postgres -v ON_ERROR_STOP=1 -v senha="$SENHA" <<'SQL'
SET password_encryption = 'scram-sha-256';
CREATE ROLE selfcontrol LOGIN PASSWORD :'senha';
CREATE DATABASE selfcontrol OWNER selfcontrol;
REVOKE ALL ON DATABASE selfcontrol FROM PUBLIC;
SQL
```

Para trocar a senha depois, use o mesmo bloco com `ALTER ROLE selfcontrol PASSWORD :'senha';`.

**Teste a senha de dentro do `davimf-api`, nunca com `psql -h 127.0.0.1` no container do
Postgres:** o `pg_hba.conf` da imagem libera loopback como `trust`, então esse teste passa com
qualquer senha. Só conexões de outros containers (`host all all all scram-sha-256`) conferem.

```bash
API=$(docker ps --no-trunc --format '{{.Names}}\t{{.Command}}' | grep 'dist/server/src/index.js' | cut -f1)
docker exec "$API" node -e "const p=require('postgres');const s=p(process.env.ELF_DATABASE_URL,{max:1});s\`select current_user\`.then(r=>{console.log(r);return s.end()}).catch(e=>{console.error(e.message);process.exit(1)})"
```

`ELF_DATABASE_URL` aponta para esse banco com o role `selfcontrol` (usuário e senha antes de
`@postgres:5432/selfcontrol`).

Migrations: depois do deploy do `davimf-api`, rode via SSH (com `$API` como acima)

```bash
docker exec -it "$API" node scripts/elf-migrate.mjs
```

Ele aplica, em ordem, o que ainda não estiver em `elf_migrations`. Rodar de novo é seguro
("nada pendente"). Nunca edite uma migration já aplicada: corrija com uma nova.

Em desenvolvimento: `cd server && npm run elf:migrate` (lê `../.env`).

## Variáveis de ambiente (recurso `davimf-api`)

| Variável | Valor |
|---|---|
| `ELF_DATABASE_URL` | `postgres://selfcontrol:SENHA@app-postgres:5432/selfcontrol` (`app-postgres` é o alias do Postgres na rede `coolify`) |
| `ELF_SESSION_SECRET` | ≥ 32 bytes, **diferente** de `DASHBOARD_SESSION_SECRET` |
| `ELF_APP_ORIGINS` | `https://elf.davimf.dev,http://localhost:5173,http://tauri.localhost,https://tauri.localhost,tauri://localhost` |
| `ELF_DISCORD_REDIRECT_URI` | `https://elf.davimf.dev/api/elf/auth/callback` |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Os mesmos do site |
| `ELF_PAIRING_SIGNING_SECRET` | ≥ 32 bytes. Assina o `pollToken` do pareamento |
| `ELF_PAIRING_ENCRYPTION_SECRET` | ≥ 32 bytes, **diferente** do anterior. Cifra a sessão enquanto espera a coleta |

Gerar cada segredo (rode uma vez para cada variável; os três precisam ser diferentes):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Discord

No Developer Portal, na mesma aplicação do site, adicione em **OAuth2 → Redirects**:

- `https://elf.davimf.dev/api/elf/auth/callback`
- `http://localhost:5173/api/elf/auth/callback` (dev, via proxy do Vite do `$elfControl`)

O login do `$elfControl` é separado do login do site: sessão, cookie e segredo próprios.
Revogar um não derruba o outro.

## Coolify: recurso `elfcontrol-web`

Recurso estático apontando para o repositório `$elfControl`:

- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm turbo run build --filter=@elf/web`
- Publish directory: `apps/web/dist`
- Custom Nginx Configuration: o conteúdo de `apps/web/nginx.conf` daquele repositório

No Nginx Proxy Manager, crie o proxy host `elf.davimf.dev` → `elfcontrol-web:80` com TLS, e
uma Custom Location `/api/elf/` → `davimf-api:3000`.

## Verificação

```bash
curl -i https://elf.davimf.dev/api/elf/health
```

Esperado: `200`, `"database":"ok"` e o header `X-Request-Id`. Depois, abra
`https://elf.davimf.dev/api/elf/auth/start?returnTo=/`, autorize no Discord e confira que
`elf_session` e `elf_device` aparecem como `HttpOnly` e que a URL de retorno não carrega credencial.
