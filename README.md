# Grant Finder

Canada-wide arts & culture grant finder (Ontario corpus first) on **Cloudflare Workers + D1 + R2 + Cron**, **Astro**, and **Resend** (stubbed until keys exist).

UI: **neobrutalism** (yellow palette from [neobrutalism.dev](https://www.neobrutalism.dev/)) — shadcn/ui + Tailwind v4, Archivo Black + Space Grotesk.

## What’s in this slice

- Guest browse / search of seeded Ontario arts grants + grant detail pages
- Connect directory (stub listed writers)
- D1 schema for grants, users (seeker individual/org + writer), profiles, saves, subscription fields
- Better Auth magic-link (Resend) + Paddle billing
- Drizzle ORM schema (`src/lib/db/schema.ts`); migrations applied **only** by Wrangler
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
| `npm run db:generate` | Diff `schema.ts` → new SQL under `migrations/` (commit it) |
| `npm run db:migrate:local` | Apply `migrations/` to local D1 via Wrangler |
| `npm run db:migrate:remote` | Apply `migrations/` to remote D1 via Wrangler |
| `npm run db:seed:local` | Load `scripts/seed.sql` |
| `npm run db:reset:local` | Migrate + seed |
| `npm run build` | Production Worker build |
| `npm run preview` | Preview the Worker build locally |
| `npm run generate-types` | Regenerate `worker-configuration.d.ts` |

### Database (Drizzle → Wrangler)

One pipeline — **do not** use `drizzle-kit migrate` / `push` against D1:

1. Edit `src/lib/db/schema.ts`
2. `npm run db:generate` → commits a new `migrations/000N_*.sql` (+ `migrations/meta/`)
3. `npm run db:migrate:local` then `npm run db:migrate:remote`
4. Deploy the Worker

Wrangler `migrations_dir` already points at `migrations/` (same folder Drizzle writes). Historical `0001`–`0006` are hand-written; `0007_drizzle_baseline.sql` is a **no-op** so staging (already on 0006) doesn’t re-CREATE tables while the Drizzle journal/snapshot stay aligned for future diffs.

Better Auth uses `@better-auth/drizzle-adapter` (`provider: "sqlite"`, `camelCase: true`) over the same `schema.ts` auth tables. Hot paths (`grants.ts`, discovery runner/enrich, writers) also query via Drizzle.

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
| `PADDLE_API_KEY` | No | Paddle Billing API key (omit to stub checkout) |
| `PADDLE_WEBHOOK_SECRET` | No | Notification destination secret |
| `PADDLE_ENV` | No | `sandbox` (default) or `production` |
| `PADDLE_PRICE_SEEKER` | For real checkout | Price ID for seeker paid |
| `PADDLE_PRICE_WRITER` | For real checkout | Price ID for writer listing |

Wrangler `vars` already set: `APP_NAME`, `DEFAULT_PROVINCE=ON`.

## Bindings (`wrangler.jsonc`)

- **D1** `DB` → database name `grants`
- **R2** `ASSETS_BUCKET` → `grants-assets` (unused in this slice)
- **Cron** `0 14 * * *` → `scheduled` handler stub in `src/worker.ts`

## Auth (Better Auth)

Magic-link only (no passwords), sessions via **Drizzle → D1**, Resend for delivery. **No** `@better-auth/stripe` — billing is Paddle.

- `GET/POST /api/auth/*` — Better Auth catch-all (`[...all].ts`)
- `/sign-in` — request a magic link
- `POST /api/auth/sign-out` — clear session cookie
- Adapter: `drizzleAdapter(db, { provider: "sqlite", schema, camelCase: true })` in `src/lib/auth.ts`
- Schema: `user` / `session` / `account` / `verification` in `src/lib/db/schema.ts` (camelCase columns from `0002_better_auth.sql`; already baselined — no new migration for the adapter switch)

## Billing (Paddle)

Merchant of Record for **seeker paid** + **writer paid listing**.

| Piece | Detail |
| --- | --- |
| Client | `src/lib/paddle.ts` — create transaction → `checkout.url` |
| Checkout | `POST /api/paddle/checkout` (signed-in) |
| Webhook | `POST /api/paddle/webhook` — verify `Paddle-Signature` |
| UI | `/pricing`, `/billing/success`, `/billing/cancel` |
| Stub | No `PADDLE_API_KEY` → flip tier/listing locally + redirect success |

### Paddle sandbox setup

1. Create a **sandbox** account at https://sandbox-vendors.paddle.com  
2. Catalog → Products: **Seeker paid** + **Writer listing** → copy Price IDs (`pri_…`)  
3. Developer tools → Authentication → create API key → `PADDLE_API_KEY`  
4. Developer tools → Notifications → add destination  
   - URL: `https://canada-grant-finder.andy8tran.workers.dev/api/paddle/webhook`  
   - Events: `subscription.activated`, `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.past_due`, `transaction.completed`  
   - Copy endpoint secret → `PADDLE_WEBHOOK_SECRET`  
5. Checkout → **Default payment link** → point at `https://canada-grant-finder.andy8tran.workers.dev/billing/success` (required for `checkout.url`)  
6. Set secrets / `.dev.vars`: `PADDLE_ENV=sandbox`, price IDs, keys  

### Test

```bash
# Stub (no keys): sign in → /pricing → Upgrade — tier flips immediately
# Sandbox: same flow opens Paddle Checkout; complete with test card; webhook sets paid/listed
```

Cancel/refund in Paddle sandbox → webhook downgrades `subscription_tier=free` and unlists writers.

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

**Deadlines:** ISO `YYYY-MM-DD` only (one or many via `deadlines_json`). Prose like “rolling” / “early 2026” goes in `deadline_notes`, never as a date.

**Open / closed** (America/Toronto calendar day):
- **Open:** `status=rolling`, or any deadline date ≥ today
- **Closed:** has ≥1 ISO date and **all** dates &lt; today (not rolling)
- **Unknown (neither filter):** null / notes-only — excluded from both Open and Closed

Past deadline chips are greyed out; today/upcoming keep full emphasis.

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
