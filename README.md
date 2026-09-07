# davimf.dev

Personal developer portfolio and tooling platform. Built with React + TypeScript, deployed on own VPS using Coolify.

**Live:** https://davimf.dev

---

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Netlify Functions (serverless)
- **Database:** Neon (PostgreSQL)
- **Auth:** Discord OAuth2
- **Payments:** Mercado Pago

---

## Public Features

No login required.

### Portfolio & Profile
| Route | Description |
|---|---|
| `/` | Landing page |
| `/portfolio` | Project showcase |
| `/resume` | CV / résumé |
| `/products` | Services and products offered |
| `/contact` | Contact form |
| `/plans` | Pricing plans for Discord bot and FiveM services (Mercado Pago checkout) |

### Tools
| Route | Description |
|---|---|
| `/calc` | Calculator |
| `/roulette` | Random choice roulette wheel |
| `/encurtador` | URL shortener - shorten any link and get a copyable short URL instantly, no account needed |
| `/r/:code` | Short URL redirect handler |

---

## Features Requiring Discord Login

Authenticate via Discord OAuth at the top-right corner.

### URL Shortener (extended)
- Full history of created links
- Delete links

### Todo List - `/todo`
- Create, edit, complete and delete tasks
- Due dates and times
- Priority levels (Low / Medium / High)
- Recurrence (Daily / Weekly / Monthly)
- Synced to your account

### Finance Manager - `/finances`
- Multiple accounts (bank, wallet, etc.)
- Income and expense transactions
- Transfers between accounts
- Expense category chart
- Payment type tracking (PIX, Card)

### Bot Dashboard - `/dashboard`
- Lists all Discord servers where you have Admin / Manage Server permission
- Shows which servers already have the bot installed
- One-click invite to add the bot to a server

### Bot Config - `/dashboard/:guildId`
- **Personalization:** command prefix, embed color, auto-role on member join
- **Commands:** enable/disable individual bot commands per server
- **Security:** toggle the entry verification module

---

## License

Private - all rights reserved.
