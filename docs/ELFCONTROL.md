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

### Rotas (Plano 1)

| Rota | Descrição |
|---|---|
| `GET /api/elf/health` | 200 com o banco ok, 503 se o banco cair |
| `GET /api/elf/auth/start?returnTo=/caminho` | Redireciona para o Discord (escopo `identify`) |
| `GET /api/elf/auth/callback` | Cria usuário, dispositivo web e sessão numa transação; seta `elf_session` e `elf_device` |
| `GET /api/elf/auth/me` | Usuário e sessão atuais (cookie ou Bearer) |
| `POST /api/elf/auth/logout` | Revoga a sessão no servidor |

## Banco

Banco **próprio** no mesmo Postgres 17 da VPS. Nunca reutilize `davimf_dev`: `ELF_DATABASE_URL`
não tem nome alternativo e não cai para `DATABASE_URL` de propósito.

Criação (uma vez, como superusuário no container `postgres`; troque a senha por uma gerada):

```sql
CREATE ROLE selfcontrol LOGIN PASSWORD 'troque-esta-senha';
CREATE DATABASE selfcontrol OWNER selfcontrol;
```

`ELF_DATABASE_URL` aponta para esse banco com o role `selfcontrol` (usuário e senha antes de
`@postgres:5432/selfcontrol`).

Migrations: depois do deploy do `davimf-api`, abra o terminal do container no Coolify e rode

```bash
node scripts/elf-migrate.mjs
```

Ele aplica, em ordem, o que ainda não estiver em `elf_migrations`. Rodar de novo é seguro
("nada pendente"). Nunca edite uma migration já aplicada: corrija com uma nova.

Em desenvolvimento: `cd server && npm run elf:migrate` (lê `../.env`).

## Variáveis de ambiente (recurso `davimf-api`)

| Variável | Valor |
|---|---|
| `ELF_DATABASE_URL` | banco `selfcontrol` em `postgres:5432`, role `selfcontrol` |
| `ELF_SESSION_SECRET` | ≥ 32 bytes, **diferente** de `DASHBOARD_SESSION_SECRET` |
| `ELF_APP_ORIGINS` | `https://elf.davimf.dev,http://localhost:5173,http://tauri.localhost,https://tauri.localhost,tauri://localhost` |
| `ELF_DISCORD_REDIRECT_URI` | `https://elf.davimf.dev/api/elf/auth/callback` |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Os mesmos do site |

Gerar o segredo de sessão:

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
