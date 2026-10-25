/// <reference types="astro/client" />

/**
 * Cloudflare bindings + secrets.
 * Optional: run `npm run generate-types` for full workerd runtime typings
 * (writes gitignored `worker-configuration.d.ts`).
 */
interface Env {
	DB: D1Database;
	ASSETS_BUCKET: R2Bucket;
	ASSETS: Fetcher;
	APP_NAME: string;
	DEFAULT_PROVINCE: string;
	RESEND_API_KEY?: string;
	SESSION_SECRET?: string;
	PUBLIC_APP_URL?: string;
	STRIPE_SECRET_KEY?: string;
	STRIPE_WEBHOOK_SECRET?: string;
}

declare namespace Cloudflare {
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	interface Env extends globalThis.Env {}
}
