import type { APIRoute } from 'astro';
import { isAdminAuthed } from '@/lib/admin';
import { getDb, getEnv } from '@/lib/db';
import { enrichPendingBatch, enrichProposal } from '@/lib/discovery/enrich';

export const POST: APIRoute = async (context) => {
	const env = getEnv();
	if (!isAdminAuthed(context.request, env)) {
		return context.redirect('/admin/login');
	}

	const db = getDb();
	const form = await context.request.formData();
	const id = form.get('id') ? String(form.get('id')) : '';
	const bulk = form.get('bulk');

	if (bulk) {
		const result = await enrichPendingBatch(db, env, { limit: 10, delayMs: 1500 });
		return context.redirect(
			`/admin/proposals?status=pending&enriched=${result.ok}&failed=${result.failed}`,
		);
	}

	if (id) {
		const result = await enrichProposal(db, env, id);
		const flag = result.ok ? '1' : '0';
		return context.redirect(`/admin/proposals?status=pending&enrich=${flag}&id=${id}`);
	}

	return context.redirect('/admin/proposals');
};
