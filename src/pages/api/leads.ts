import type { APIRoute } from 'astro';
import { EntitlementError, entitlementJson } from '@/lib/billing';
import { getDb, getEnv } from '@/lib/db';
import { createEmailSender } from '@/lib/email';
import { createWriterLead } from '@/lib/leads';

export const POST: APIRoute = async (context) => {
	const env = getEnv();
	const db = getDb();
	const accept = context.request.headers.get('accept') || '';
	const wantsHtml = accept.includes('text/html');

	try {
		let writerUserId = '';
		let message = '';
		const ct = context.request.headers.get('content-type') || '';
		if (ct.includes('application/json')) {
			const body = (await context.request.json()) as {
				writerUserId?: string;
				message?: string;
			};
			writerUserId = String(body.writerUserId ?? '').trim();
			message = String(body.message ?? '');
		} else {
			const form = await context.request.formData();
			writerUserId = String(form.get('writerUserId') ?? '').trim();
			message = String(form.get('message') ?? '');
		}

		if (!writerUserId) {
			throw new EntitlementError('NOT_FOUND', 'writerUserId is required', 400);
		}

		const result = await createWriterLead(db, {
			seeker: context.locals.user,
			writerUserId,
			message,
			email: createEmailSender(env),
			appUrl: env.PUBLIC_APP_URL || context.url.origin,
		});

		if (wantsHtml) {
			return context.redirect(`/connect?lead=sent&writer=${encodeURIComponent(writerUserId)}`);
		}
		return Response.json(result, { status: 201 });
	} catch (e) {
		if (e instanceof EntitlementError) {
			if (wantsHtml) {
				return context.redirect(
					`/connect?error=${encodeURIComponent(e.code)}`,
				);
			}
			return entitlementJson(e);
		}
		throw e;
	}
};
