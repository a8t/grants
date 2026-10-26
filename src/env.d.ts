/// <reference types="astro/client" />

/**
 * Cloudflare bindings + secrets.
 * Optional: run `npm run generate-types` for full workerd runtime typings
 * (writes gitignored `worker-configuration.d.ts`).
 */
type Ai = {
	run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
};

interface Env {
	DB: D1Database;
	ASSETS_BUCKET: R2Bucket;
	ASSETS: Fetcher;
	AI?: Ai;
	APP_NAME: string;
	DEFAULT_PROVINCE: string;
	ADMIN_SECRET?: string;
	RESEND_API_KEY?: string;
	/** @deprecated Prefer BETTER_AUTH_SECRET */
	SESSION_SECRET?: string;
	BETTER_AUTH_SECRET?: string;
	BETTER_AUTH_URL?: string;
	PUBLIC_APP_URL?: string;
	OPENAI_API_KEY?: string;
	/** auto (default) | workers-ai | openai */
	GRANT_EXTRACTOR_PROVIDER?: string;
	/** When "1", discovery cron also LLM-enriches new pending proposals (rate-limited). */
	DISCOVERY_LLM_ENRICH?: string;
	/** Paddle Billing (sandbox|production) */
	PADDLE_API_KEY?: string;
	PADDLE_WEBHOOK_SECRET?: string;
	PADDLE_ENV?: string;
	PADDLE_PRICE_SEEKER?: string;
	PADDLE_PRICE_WRITER?: string;
}

declare namespace Cloudflare {
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	interface Env extends globalThis.Env {}
}

declare namespace App {
	interface Locals {
		user: {
			id: string;
			name: string;
			email: string;
			emailVerified: boolean;
			image?: string | null;
			createdAt: Date;
			updatedAt: Date;
			accountType?: string | null;
			seekerKind?: string | null;
			subscriptionTier?: string | null;
			paddleCustomerId?: string | null;
			paddleSubscriptionId?: string | null;
			subscriptionStatus?: string | null;
		} | null;
		session: {
			id: string;
			userId: string;
			token: string;
			expiresAt: Date;
			createdAt: Date;
			updatedAt: Date;
			ipAddress?: string | null;
			userAgent?: string | null;
		} | null;
	}
}
