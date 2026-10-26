import { defineConfig } from 'drizzle-kit';

/**
 * Generate SQL into `migrations/` (same folder Wrangler applies).
 * Do not use drizzle-kit migrate/push against D1 — only Wrangler applies.
 */
export default defineConfig({
	schema: './src/lib/db/schema.ts',
	out: './migrations',
	dialect: 'sqlite',
	strict: true,
	verbose: true,
});
