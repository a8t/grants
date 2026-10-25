/// <reference types="astro/client" />

/**
 * Cloudflare bindings + secrets.
 * Run `npm run generate-types` to refresh `worker-configuration.d.ts` (gitignored);
 * this interface keeps local typecheck working without that file.
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
	interface Env extends Env {}
}
