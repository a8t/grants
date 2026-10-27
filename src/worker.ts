import { handle } from '@astrojs/cloudflare/handler';
import { enrichPendingBatch } from './lib/discovery/enrich';
import { runAllEnabledSources } from './lib/discovery/runner';
import { createEmailSender } from './lib/email';
import { runReminderSweep } from './lib/reminders';

/**
 * Astro fetch + daily discovery cron + paid-seeker deadline reminders.
 */
export default {
	async fetch(request, env, ctx) {
		return handle(request, env, ctx);
	},
	async scheduled(controller, env, ctx) {
		ctx.waitUntil(
			(async () => {
				console.log(
					`[cron] tick ${new Date(controller.scheduledTime).toISOString()} cron=${controller.cron}`,
				);

				try {
					const reminders = await runReminderSweep(
						env.DB,
						createEmailSender(env),
						{
							now: new Date(controller.scheduledTime),
							appUrl: env.PUBLIC_APP_URL,
						},
					);
					console.log('[cron] reminders', JSON.stringify(reminders));
				} catch (e) {
					console.error('[cron] reminders failed', e);
				}

				try {
					const summaries = await runAllEnabledSources(env.DB);
					console.log('[cron] discovery done', JSON.stringify(summaries));
				} catch (e) {
					console.error('[cron] discovery failed', e);
				}

				if (env.DISCOVERY_LLM_ENRICH === '1') {
					try {
						const enrich = await enrichPendingBatch(env.DB, env, {
							limit: 8,
							delayMs: 2000,
						});
						console.log('[cron] llm enrich', JSON.stringify(enrich));
					} catch (e) {
						console.error('[cron] llm enrich failed', e);
					}
				}
			})(),
		);
	},
} satisfies ExportedHandler<Env>;
