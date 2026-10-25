# Grant Finder

Canada-wide arts & culture grant finder (Ontario corpus first) on **Cloudflare Workers + D1 + R2 + Cron**, **Astro**, and **Resend** (stubbed until keys exist).

UI: **neobrutalism** (yellow palette from [neobrutalism.dev](https://www.neobrutalism.dev/)) — shadcn/ui + Tailwind v4, Archivo Black + Space Grotesk.

## What’s in this slice

- Guest browse / search of seeded Ontario arts grants + grant detail pages
- Connect directory (stub listed writers)
- D1 schema for grants, users (seeker individual/org + writer), profiles, saves, subscription fields
- Magic-link + Resend + Stripe behind clear stub interfaces
- Daily cron hook (reminder sweep stub)

## Prerequisites

- Node 22+
- npm
- Cloudflare account only needed for remote deploy (local D1 works offline via Wrangler)

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars   # optional — stubs work without keys
npm run db:reset:local           # apply migrations + seed ~18 grants + 4 writers
npm run dev                      # http://localhost:4321
```

### Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Astro + Cloudflare platformProxy (local D1/R2) |
| `npm run db:migrate:local` | Apply `migrations/` to local D1 |
| `npm run db:seed:local` | Load `scripts/seed.sql` |
| `npm run db:reset:local` | Migrate + seed |
| `npm run build` | Production Worker build |
| `npm run preview` | Preview the Worker build locally |
| `npm run generate-types` | Regenerate `worker-configuration.d.ts` |

## Env vars

Set in `.dev.vars` (local) or Wrangler secrets (prod):

| Var | Required? | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | No | Send magic-link / notification email. **Stub logs + returns debug link when missing.** |
| `SESSION_SECRET` | No (later) | Sign session cookies |
| `PUBLIC_APP_URL` | No | Absolute links in emails (defaults to request origin) |
| `STRIPE_SECRET_KEY` | No | Checkout stub until wired |
| `STRIPE_WEBHOOK_SECRET` | No | Webhooks later |

Wrangler `vars` already set: `APP_NAME`, `DEFAULT_PROVINCE=ON`.

## Bindings (`wrangler.jsonc`)

- **D1** `DB` → database name `grants`
- **R2** `ASSETS_BUCKET` → `grants-assets` (unused in this slice)
- **Cron** `0 14 * * *` → `scheduled` handler stub in `src/worker.ts`

Replace the placeholder `database_id` before deploying to Cloudflare; create the D1 DB and R2 bucket with Wrangler, then paste real IDs.

## Auth / email stubs

- `POST /api/auth/request-link` — stores hashed magic-link token; emails via Resend or stub
- `GET /api/auth/verify?token=…` — consumes token (no session cookie yet)

## Design notes

- Palette: **neobrutalism yellow** (`npx shadcn add https://neobrutalism.dev/r/styling/yellow.json`)
- Components copied from the neobrutalism registry (Button, Card, Badge, Input)
- React islands where helpful (`GrantSearchForm`); pages are Astro server routes reading D1

## Deploy (Cloudflare)

**Live staging (workers.dev):** https://canada-grant-finder.andy8tran.workers.dev

Resources already provisioned on Andy’s CF account:

| Resource | Name / id |
| --- | --- |
| Worker | `canada-grant-finder` |
| D1 | `grants` (`365e60ad-73fc-4c6e-90ab-666f763da1fe`) |
| R2 | `grants-assets` |
| KV (Astro sessions) | auto-provisioned `SESSION` |

Auth for agents / CI: use the **Cloudflare Worker** item in 1Password Homelab (`token` + `account id`). The Cloud Agent env `CLOUDFLARE_API_TOKEN` was a different, under-scoped token — prefer reading from 1P.

```bash
export CLOUDFLARE_API_TOKEN="$(op read 'op://Homelab/Cloudflare Worker/token')"
export CLOUDFLARE_ACCOUNT_ID="$(op read 'op://Homelab/Cloudflare Worker/account id')"
npm run build
npx wrangler deploy
# first-time / schema changes:
npx wrangler d1 migrations apply grants --remote
npx wrangler d1 execute grants --remote --file=./scripts/seed.sql
```

### Staging story

Nothing fancy yet — by design for MVP:

1. **Now:** `canada-grant-finder.*.workers.dev` **is** staging (seed data, stub auth). Treat it as shareable preview, not production.
2. **Next (when we need a prod cut):** add Wrangler `env.staging` / `env.production` with separate worker names + D1 (`grants-staging` / `grants`) + R2 buckets; custom domain only on production.
3. **PR previews:** optional later via Workers Versions / GitHub — skip until the corpus and auth are real.

Secrets (`RESEND_API_KEY`, etc.) still optional; magic-link stubs without them.
