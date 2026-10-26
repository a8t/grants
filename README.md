# Grant Finder

Canada-wide arts & culture grant finder (Ontario corpus first) on **Cloudflare Workers + D1 + R2 + Cron**, **Astro**, and **Resend** (stubbed until keys exist).

UI: **neobrutalism** (yellow palette from [neobrutalism.dev](https://www.neobrutalism.dev/)) — shadcn/ui + Tailwind v4, Archivo Black + Space Grotesk.

## What’s in this slice

- Guest browse / search of seeded Ontario arts grants + grant detail pages
- Connect directory (stub listed writers)
- D1 schema for grants, users (seeker individual/org + writer), profiles, saves, subscription fields
- Better Auth magic-link (Resend) + Stripe behind clear stub interfaces
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
| `ADMIN_SECRET` | For `/admin` | Shared secret for discovery admin |
| `BETTER_AUTH_SECRET` | Recommended | Session signing (≥32 chars). Falls back to `SESSION_SECRET`, then a insecure local default. |
| `RESEND_API_KEY` | No | Send magic-link / notification email. **Stub logs the link when missing.** |
| `PUBLIC_APP_URL` / `BETTER_AUTH_URL` | No | Absolute app origin for magic-link URLs (defaults to request origin) |
| `SESSION_SECRET` | No | Legacy fallback for `BETTER_AUTH_SECRET` |
| `OPENAI_API_KEY` | No | Optional LLM enrich fallback |
| `GRANT_EXTRACTOR_PROVIDER` | No | `auto` (default) · `workers-ai` · `openai` |
| `DISCOVERY_LLM_ENRICH` | No | Set `1` to LLM-enrich new proposals during cron (rate-limited) |
| `STRIPE_SECRET_KEY` | No | Checkout stub until wired |
| `STRIPE_WEBHOOK_SECRET` | No | Webhooks later |

Wrangler `vars` already set: `APP_NAME`, `DEFAULT_PROVINCE=ON`.

## Bindings (`wrangler.jsonc`)

- **D1** `DB` → database name `grants`
- **R2** `ASSETS_BUCKET` → `grants-assets` (unused in this slice)
- **Cron** `0 14 * * *` → `scheduled` handler stub in `src/worker.ts`

## Auth (Better Auth)

Magic-link only (no passwords), D1-backed sessions, Resend for delivery.

- `GET/POST /api/auth/*` — Better Auth catch-all (`[...all].ts`)
- `/sign-in` — request a magic link
- `POST /api/auth/sign-out` — clear session cookie
- Schema: migration `0002_better_auth.sql` (`user` / `session` / `account` / `verification`)

## Design notes

- Palette: **neobrutalism yellow** (`npx shadcn add https://neobrutalism.dev/r/styling/yellow.json`)
- Components copied from the neobrutalism registry (Button, Card, Badge, Input)
- React islands where helpful (`GrantSearchForm`); pages are Astro server routes reading D1

## Discovery + LLM enrich

Corpus roadmap (research): project store `docs/grant-sources.md`.

| Piece | Detail |
| --- | --- |
| Sources registry | D1 `grant_sources` (TAC, OAC, Canadian Heritage adapters) |
| Staging | D1 `grant_proposals` — pending / approved / rejected |
| Adapters | `tac`, `oac`, `canadian_heritage` (robots-aware HTML) |
| LLM extract | `GrantPageExtractor` — Workers AI first, OpenAI fallback |
| Cron | Daily discovery; optional LLM enrich when `DISCOVERY_LLM_ENRICH=1` |
| Admin | `/admin` — shared secret `ADMIN_SECRET`; **Enrich with LLM**, edit before Approve |

LLM fields are **never** auto-published. Admin compares scrape vs extract, edits, then Approve.

Workers AI binding (`AI`) is declared in `wrangler.jsonc`. Default model: `@cf/meta/llama-3.1-8b-instruct-fp8` (falls back to `@cf/meta/llama-3.2-3b-instruct`). Set `OPENAI_API_KEY` only if Workers AI quality is insufficient.

```bash
# local
echo 'ADMIN_SECRET=dev-admin-secret-change-me' >> .dev.vars
npm run db:reset:local
npm run dev
# open http://localhost:4321/admin/login
```

## Deploy (Cloudflare)

**Live staging (workers.dev):** https://canada-grant-finder.andy8tran.workers.dev  
**Admin:** https://canada-grant-finder.andy8tran.workers.dev/admin/login

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
npx wrangler d1 execute grants --remote --file=./scripts/seed-more.sql
npx wrangler secret put ADMIN_SECRET
```

### Staging story

Nothing fancy yet — by design for MVP:

1. **Now:** `canada-grant-finder.*.workers.dev` **is** staging (seed data, stub auth). Treat it as shareable preview, not production.
2. **Next (when we need a prod cut):** add Wrangler `env.staging` / `env.production` with separate worker names + D1 (`grants-staging` / `grants`) + R2 buckets; custom domain only on production.
3. **PR previews:** optional later via Workers Versions / GitHub — skip until the corpus and auth are real.

Secrets (`RESEND_API_KEY`, etc.) still optional; magic-link stubs without them.
