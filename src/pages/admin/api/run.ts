import type { APIRoute } from 'astro';
import { isAdminAuthed } from '@/lib/admin';
import { getDb, getEnv } from '@/lib/db';
import { runAllEnabledSources, runSource, type SourceRow } from '@/lib/discovery/runner';

export const POST: APIRoute = async (context) => {
	const env = getEnv();
	if (!isAdminAuthed(context.request, env)) {
		return context.redirect('/admin/login');
	}

	const db = getDb();
	const form = await context.request.formData();
	const all = form.get('all');
	const sourceId = form.get('source_id');

	if (all) {
		await runAllEnabledSources(db);
		return context.redirect('/admin/sources?ran=all');
	}

	if (sourceId) {
		const source = await db
			.prepare(`SELECT id, name, adapter_key, enabled FROM grant_sources WHERE id = ?`)
			.bind(String(sourceId))
			.first<SourceRow>();
		if (source) await runSource(db, source);
		return context.redirect('/admin/sources?ran=1');
	}

	return context.redirect('/admin/sources');
};
