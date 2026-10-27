import path from 'node:path';
import {
	defineWorkersConfig,
	readD1Migrations,
} from '@cloudflare/vitest-pool-workers/config';

/**
 * Integration tests — run inside the Workers runtime (Miniflare) with local D1.
 * Migrations applied via setup file; Resend/Paddle/AI stay unset (stubs).
 */
export default defineWorkersConfig(async () => {
	const migrationsPath = path.join(import.meta.dirname, 'migrations');
	const migrations = await readD1Migrations(migrationsPath);

	return {
		resolve: {
			alias: {
				'@': path.resolve(import.meta.dirname, './src'),
			},
		},
		test: {
			name: 'integration',
			include: ['tests/integration/**/*.test.ts'],
			setupFiles: ['./tests/integration/apply-migrations.ts'],
			poolOptions: {
				workers: {
					// No AI/R2 — keep CI offline and free of account usage.
					wrangler: { configPath: './wrangler.test.jsonc' },
					miniflare: {
						bindings: {
							TEST_MIGRATIONS: migrations,
						},
					},
				},
			},
		},
	};
});
