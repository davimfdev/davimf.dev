# davimf.dev

Personal developer portfolio, tooling platform and storefront for the BaseBot
(Discord) and FMM (FiveM) products. React + TypeScript on the front, Express +
PostgreSQL on the back, self-hosted on a VPS with Coolify.

**Live:** https://davimf.dev

---

## Stack

| Layer    | Tech                                                              |
| -------- | ----------------------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS, React Router 6        |
| Backend  | Node 22, Express 4, TypeScript (`server/`)                        |
| Database | PostgreSQL over TCP via `postgres.js` (pooled)                    |
| Auth     | Discord OAuth2 (signed session cookie) + a legacy JWT stack       |
| Payments | Mercado Pago, transparent checkout (Orders API) and subscriptions |
| E-mail   | Resend                                                            |
| Tests    | Vitest + Testing Library (81 test files)                          |
| Deploy   | Docker + Coolify behind Nginx Proxy Manager                       |

Site and API share the origin `https://davimf.dev`. The browser always calls
`/api/...` on the same host, so there is **no CORS anywhere**.

```
Internet
  â””â”€â”€ Nginx Proxy Manager (TLS, HTTP/2)
        â”œâ”€â”€ /      â”€â”€â–º davimf-site : 80    nginx serving the Vite build
        â””â”€â”€ /api/  â”€â”€â–º davimf-api  : 3000  Node/Express container
```

> **Netlify heritage:** the 44 HTTP handlers still live in `netlify/functions/*.ts`
> and are unchanged. `server/` imports them and adapts both handler styles
> (`export const handler` and `export default (req: Request) => Response`) to
> Express, so every endpoint kept its original URL. See
> [`docs/VPS_MIGRATION.md`](docs/VPS_MIGRATION.md).

---

## Public routes

No login required.

### Portfolio & profile

| Route        | Description                                                              |
| ------------ | ------------------------------------------------------------------------ |
| `/`          | Landing page with the ecosystem graph hero, work blocks, stack and tools |
| `/about`     | About, with the project/tech breakdown                                   |
| `/portfolio` | Project showcase, filterable by technology                               |
| `/resume`    | CV / rÃ©sumÃ© (PDF export via jsPDF + html2canvas)                         |
| `/products`  | Services and products offered                                            |
| `/plans`     | Pricing for Discord bots and FiveM factions                              |
| `/contact`   | Contact form                                                             |

### Tools

| Route                 | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `/tools`              | Index of every tool                                           |
| `/calc`               | Calculator                                                    |
| `/roulette`           | Random-choice roulette wheel                                  |
| `/password-generator` | Password generator; config and history kept in `localStorage` |
| `/encurtador`         | URL shortener; shorten any link, no account needed            |
| `/r/:shortCode`       | Short-URL redirect handler                                    |

### Store & legal

| Route                                                    | Description                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| `/fmm`                                                   | FMM (FiveM Mod Manager) plans and checkout                           |
| `/fmm-activated`                                         | Post-activation landing for an FMM license                           |
| `/ticket/:id`                                            | Read-only view of a Discord ticket transcript (payload is encrypted) |
| `/privacy-policy`, `/terms-of-service`, `/refund-policy` | Current legal documents                                              |
| `/legal/:version/<doc>`                                  | Any published legal snapshot, addressed by version                   |

Legal text is versioned and content-hashed (`src/content/legal/`). Every order
records which version the customer accepted plus the hash of the exact text, so a
disputed purchase can prove which contract was in force
(`db/008_order_legal_acceptance.sql`).

The whole UI is bilingual (pt/en) through `src/context/LanguageContext.tsx`; the
translation type forces both languages to stay in sync.

---

## Routes requiring Discord login

Authenticate through Discord OAuth from the top-right corner.

| Route         | Description                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `/todo`       | Tasks with due date/time, priority (Low/Medium/High) and recurrence (Daily/Weekly/Monthly)          |
| `/notes`      | Notes, plus a floating layer available across the site                                              |
| `/finances`   | Multiple accounts, income/expense transactions, transfers, category chart, payment type (PIX, card) |
| `/encurtador` | Extended: full link history and deletion                                                            |
| `/my-orders`  | Order history, payment status and self-service refund requests                                      |
| `/my-keys`    | FMM licenses, with the full key recoverable                                                         |
| `/fmm-admin`  | License administration (Discord ID allowlist)                                                       |

### Bot dashboard: `/dashboard`

- Lists every Discord server where you hold Admin / Manage Server
- Shows which of them already have BaseBot installed
- One-click invite to add the bot

### Bot config: `/dashboard/:guildId/<section>`

Six sections, each backed by a snapshot of the real guild (channels, roles) so
configuration never means typing raw Discord IDs:

`overview` Â· `channels` Â· `roles` Â· `moderation` Â· `security` Â· `modules`

Access levels are `owner`, `delegate` and `support`; every mutation is written to
an audit trail (`db/003_dashboard_config_audit.sql`), and mutating endpoints check
`Origin`/`Referer` against an allowlist before authenticating. The product brief
for this surface lives in [`PRODUCT.md`](PRODUCT.md).

---

## Payments

Transparent Mercado Pago checkout inside the site, with automatic FMM license
delivery and transactional e-mail. Provider-agnostic by construction: orders,
products and the license system never import anything from the provider. Only
`lib/payments/providers/mercadopago/` knows Mercado Pago exists.

- Pix, card (optional saved card and 3-D Secure), boleto and subscriptions
- Price is read from the `products` table in integer cents, never from the client
- Idempotency keys on order and payment creation; webhook events deduplicated by
  `payment_events(provider, event_key)`, so a repeat notification never issues a
  second license or a second e-mail
- Webhook origin validated by HMAC-SHA256 over the documented manifest, with a
  15-minute anti-replay window; an invalid signature is a 401 with nothing
  processed, and the payload is never the source of truth (the provider is
  re-queried)
- Encoded priority order: `SECURITY > FINANCIAL CORRECTNESS > IDEMPOTENCY >
  LICENSE DELIVERY > MODULARITY > UX`

Full reference, including sandbox test cards and webhook diagnostics:
[`docs/PAYMENTS.md`](docs/PAYMENTS.md).

---

## Project layout

```
src/                      React app
  components/ui/          Design-system primitives (Button, Surface, Field, Badgeâ€¦)
  features/               home, projects, checkout, bot-dashboard, notes
  pages/                  One file per route
  content/legal/          Versioned, hashed legal documents (pt/en)
  context/                Auth, Language (pt/en), Notes
  styles/tokens.css       The single source of visual truth

netlify/functions/        44 HTTP handlers (unchanged since the Netlify era)
  lib/dashboard/          Session, access control, guild snapshots, audit
  lib/payments/           domain / application / providers / repositories / email

server/                   Express host that mounts those handlers
  src/routes/functions.ts Explicit route inventory, no wildcards
  src/utils/              netlifyAdapter, webAdapter, env resolution

db/                       Idempotent SQL migrations, applied with psql
docs/                     Architecture, deployment and payment documentation
eslint-rules/             Custom `local/no-raw-color` rule
scripts/                  check-css-colors.mjs (the CSS half of the same rule)
```

### Design system

`src/styles/tokens.css` is the only file in the repository where a raw color value
is legal. Everywhere else, two checks refuse one:

- `local/no-raw-color` (ESLint) for `.ts` / `.tsx`
- `scripts/check-css-colors.mjs` for `.css`

Opaque tokens store channels (`230 181 102`) rather than hex, which is what makes
Tailwind's `text-accent/30` work through `<alpha-value>`. Text-token contrast is
asserted in `src/components/ui/__tests__/contrast.test.ts`. The target is WCAG 2.1
AA: every essential flow works by keyboard, and motion respects
`prefers-reduced-motion`.

---

## Running locally

Requires **Node 22+**.

```bash
cp .env.example .env      # then fill in the values
```

The same `.env` serves both halves in development.

```bash
# terminal 1: backend
cd server
npm install
npm run dev               # http://localhost:3000 (loads ../.env)

# terminal 2: frontend
npm install
npm run dev               # http://localhost:5173
```

Vite proxies `/api` to `http://localhost:3000`, keeping development same-origin
just like production. To point elsewhere:

```bash
VITE_DEV_API_PROXY=http://192.168.0.10:3000 npm run dev
```

Quick check:

```bash
curl http://localhost:3000/health       # {"status":"ok"}
curl http://localhost:3000/api/_routes  # every registered route
```

### Scripts

| Command                       | Where     | What                            |
| ----------------------------- | --------- | ------------------------------- |
| `npm run dev`                 | root      | Vite dev server                 |
| `npm run build`               | root      | Production build â†’ `dist/`      |
| `npm run preview`             | root      | Serve the production build      |
| `npm test`                    | root      | Vitest suite                    |
| `npm run lint`                | root      | ESLint + the CSS color check    |
| `npm run typecheck:functions` | root      | `tsc` over `netlify/functions/` |
| `npm run dev`                 | `server/` | Express with watch mode         |
| `npm run build`               | `server/` | `tsc` â†’ `server/dist/`          |
| `npm run typecheck`           | `server/` | Type-check only                 |
| `npm start`                   | `server/` | Run the compiled server         |

### Database

Migrations are plain, idempotent SQL applied by hand:

```bash
psql "$NETLIFY_DATABASE_URL" -f db/005_payments.sql
```

`db/001` to `db/008` cover tickets, dashboard sessions, the config audit trail, role
colors, payments, payer profiles, refund requests and legal acceptance. Note that
`003` and `004` target the **bot** database, the rest the **site** database.

Pool tuning is per-environment: `DB_POOL_MAX`, `DB_IDLE_TIMEOUT`,
`DB_CONNECT_TIMEOUT`, `DB_MAX_LIFETIME`. Behind PgBouncer in `transaction` mode,
disable prepared statements with `DB_PREPARE=false` or `PGBOUNCER=true`.

### Docker

The build context is the repository root, not `server/`:

```bash
docker build -f server/Dockerfile -t davimf-api .
docker run --rm -p 3000:3000 --env-file .env davimf-api
```

There is no `docker-compose`: the two `npm run dev` above cover development, and
Coolify orchestrates production.

---

## Configuration

Every variable is documented in [`.env.example`](.env.example); the deployment
matrix is in [`docs/VPS_MIGRATION.md`](docs/VPS_MIGRATION.md). The essentials:

| Variable                                                     | For                                                                   |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `URL`                                                        | Public base URL for short links, e-mail links and payment return URLs |
| `DATABASE_URL`                                               | Site database: urls, tasks, notes, accounts, transactions             |
| `NETLIFY_DATABASE_URL`                                       | Users/JWT, expenses, dashboard sessions, FMM licenses                 |
| `BOT_CONFIG_DATABASE_URL` / `POSTGRES_URL`                   | BaseBot configuration database                                        |
| `TICKETS_NEON`                                               | Ticket transcripts                                                    |
| `DISCORD_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI`            | Discord OAuth                                                         |
| `DASHBOARD_SESSION_SECRET`, `DASHBOARD_TOKEN_ENCRYPTION_KEY` | Session signing and token encryption                                  |
| `BOT_SUPPORT_USER_IDS`                                       | Support/admin allowlist (also gates refunds)                          |
| `MERCADOPAGO_*`, `PAYMENTS_*`, `RESEND_API_KEY`              | Payments and e-mail                                                   |
| `FMM_APP_SECRET`, `FMM_ADMIN_SECRET`, `TICKET_INGEST_SECRET` | Machine-to-machine secrets                                            |
| `JWT_SECRET`, `EXCHANGERATE_API_KEY`                         | Legacy JWT stack and the exchange-rate proxy                          |

`URL` also accepts the platform aliases `PUBLIC_SITE_URL`, `SITE_URL`, `APP_URL`,
`COOLIFY_URL`, `COOLIFY_FQDN` and `SERVICE_FQDN_*`, normalized at boot by
`server/src/utils/env.ts`. The domain is never hardcoded.

**No secret is versioned.** `.env` is gitignored; `.env.example` carries names and
comments only. Only `VITE_*` variables reach the bundle, and anything with that
prefix is public.

---

## Deployment

Two Coolify resources behind Nginx Proxy Manager:

- **`davimf-site`**: static. `npm ci` + `npm run build`, publish `dist/`. Paste
  [`nginx.conf`](nginx.conf) into "Custom Nginx Configuration" for the SPA
  fallback, cache headers and the basic security headers.
- **`davimf-api`**: Docker. Base directory `/`, dockerfile `/server/Dockerfile`.
  Exposes `:3000` with a `/health` healthcheck.

Step-by-step, including the proxy hosts and the external services to reconfigure
(Discord, Mercado Pago, the ticket-ingesting bot), is in
[`docs/VPS_MIGRATION.md`](docs/VPS_MIGRATION.md).

---

## Docs

| File                                             | Content                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [`docs/VPS_MIGRATION.md`](docs/VPS_MIGRATION.md) | Architecture, full inventory of the 44 endpoints, env matrix, Coolify and Nginx setup, troubleshooting |
| [`docs/PAYMENTS.md`](docs/PAYMENTS.md)           | Payment module architecture, schema, endpoints, Mercado Pago integration, webhook validation           |
| [`PRODUCT.md`](PRODUCT.md)                       | Product brief and design principles for the dashboard                                                  |

---

## License

Copyright Â© 2026 Davi Monteiro Fonseca. All rights reserved.  
See [LICENSE](LICENSE) for details.

