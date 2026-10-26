import path from 'node:path';
import { defineConfig } from 'vitest/config';

/** Unit tests — Node environment, pure libs only. */
export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(import.meta.dirname, './src'),
		},
	},
	test: {
		name: 'unit',
		include: ['tests/unit/**/*.test.ts'],
		environment: 'node',
		globals: false,
	},
});
