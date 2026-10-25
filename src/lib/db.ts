import { env } from 'cloudflare:workers';

/** Resolve the D1 binding (platformProxy in local `astro dev`). */
export function getDb(): D1Database {
	const db = env.DB;
	if (!db) {
		throw new Error(
			'DB binding missing. Run `npm run db:migrate:local` and ensure wrangler D1 is configured.',
		);
	}
	return db;
}

export function getEnv(): Env {
	return env as Env;
}

export function parseJsonArray(value: string | null | undefined): string[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}
