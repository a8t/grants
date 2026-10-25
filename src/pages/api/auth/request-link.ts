import type { APIRoute } from 'astro';
import { requestMagicLink } from '@/lib/auth';
import { getDb, getEnv } from '@/lib/db';
import { createEmailSender } from '@/lib/email';

export const POST: APIRoute = async (context) => {
	const contentType = context.request.headers.get('content-type') ?? '';
	let email = '';
	let next: string | undefined;

	if (contentType.includes('application/json')) {
		const body = (await context.request.json()) as { email?: string; next?: string };
		email = body.email ?? '';
		next = body.next;
	} else {
		const form = await context.request.formData();
		email = String(form.get('email') ?? '');
		next = form.get('next') ? String(form.get('next')) : undefined;
	}

	try {
		const db = getDb();
		const env = getEnv();
		const appUrl = env.PUBLIC_APP_URL ?? new URL(context.request.url).origin;
		const result = await requestMagicLink(
			db,
			createEmailSender(env),
			{ email, next },
			{ appUrl, sessionSecret: env.SESSION_SECRET },
		);

		return new Response(JSON.stringify(result), {
			status: result.ok ? 200 : 400,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e) {
		return new Response(
			JSON.stringify({
				ok: false,
				error: e instanceof Error ? e.message : 'Magic-link request failed',
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } },
		);
	}
};
