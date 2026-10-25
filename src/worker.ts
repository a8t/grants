import { handle } from '@astrojs/cloudflare/handler';

/**
 * Custom Worker entry so Cron Triggers can attach beside Astro's fetch handler.
 * Reminder / digest sweeps will live in `scheduled` once Resend is wired.
 */
export default {
	async fetch(request, env, ctx) {
		return handle(request, env, ctx);
	},
	async scheduled(controller, env, ctx) {
		ctx.waitUntil(
			Promise.resolve().then(() => {
				console.log(
					`[cron] tick at ${new Date(controller.scheduledTime).toISOString()} (cron=${controller.cron}) — reminder sweep stub`,
				);
				void env;
			}),
		);
	},
} satisfies ExportedHandler<Env>;
