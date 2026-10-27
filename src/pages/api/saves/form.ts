import type { APIRoute } from 'astro';
import { EntitlementError } from '@/lib/billing';
import { getDb } from '@/lib/db';
import { createSave, deleteSave } from '@/lib/saves';

/** HTML form endpoint for grant detail save / unsave. */
export const POST: APIRoute = async (context) => {
	const user = context.locals.user;
	const form = await context.request.formData();
	const grantId = String(form.get('grantId') ?? '').trim();
	const slug = String(form.get('slug') ?? '').trim();
	const method = String(form.get('_method') ?? 'POST').toUpperCase();
	const back = slug ? `/grants/${slug}` : '/grants';

	if (!user?.id) {
		return context.redirect(`/sign-in?next=${encodeURIComponent(back)}`);
	}
	if (!grantId) {
		return context.redirect(back);
	}

	const db = getDb();
	try {
		if (method === 'DELETE') {
			await deleteSave(db, user, grantId);
			return context.redirect(`${back}?save=removed`);
		}
		await createSave(db, user, grantId);
		return context.redirect(`${back}?save=ok`);
	} catch (e) {
		if (e instanceof EntitlementError && e.code === 'SAVE_CAP') {
			return context.redirect(`${back}?save=cap`);
		}
		if (e instanceof EntitlementError && e.code === 'AUTH_REQUIRED') {
			return context.redirect(`/sign-in?next=${encodeURIComponent(back)}`);
		}
		throw e;
	}
};
