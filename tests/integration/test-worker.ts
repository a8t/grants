/** Minimal Worker entry for Vitest pool — D1/bindings only. */
export default {
	async fetch(): Promise<Response> {
		return new Response('ok');
	},
} satisfies ExportedHandler;
