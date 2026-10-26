import { handle } from '@astrojs/cloudflare/handler';
import { runAllEnabledSources } from './lib/discovery/runner';

/**
 * Custom Worker entry: Astro fetch + daily discovery cron.
 */
export default {
	async fetch(request, env, ctx) {
		return handle(request, env, ctx);
	},
	async scheduled(controller, env, ctx) {
		ctx.waitUntil(
			(async () => {
				console.log(
					`[cron] discovery tick ${new Date(controller.scheduledTime).toISOString()} cron=${controller.cron}`,
				);
				try {
					const summaries = await runAllEnabledSources(env.DB);
					console.log('[cron] discovery done', JSON.stringify(summaries));
				} catch (e) {
					console.error('[cron] discovery failed', e);
				}
			})(),
		);
	},
} satisfies ExportedHandler<Env>;
