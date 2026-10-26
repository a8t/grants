## Development

```bash
npm run db:reset:local
npm run dev
```

Use background mode when needed: `astro dev --background`, then `astro dev stop` / `status` / `logs`.

## Stack notes

- Cloudflare adapter with `platformProxy` for local D1/R2
- Custom worker entry `src/worker.ts` for Cron Triggers
- UI: neobrutalism yellow via shadcn registry (`neobrutalism.dev`)
- Auth: Better Auth magic-link (D1 sessions) + Resend / Stripe stubbed in `src/lib/`
