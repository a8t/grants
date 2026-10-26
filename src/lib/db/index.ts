import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:workers';
import * as schema from './schema';

export * from './schema';

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

/** Typed Drizzle client over the Worker D1 binding. */
export function getDrizzle(db: D1Database = getDb()) {
	return drizzle(db, { schema });
}

export type AppDb = ReturnType<typeof getDrizzle>;

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
