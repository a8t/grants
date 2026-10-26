import type { APIRoute } from 'astro';
import { isAdminAuthed } from '@/lib/admin';
import { deadlinesFromForm } from '@/lib/deadlines';
import { getDb, getEnv } from '@/lib/db';
import { approveProposal, rejectProposal } from '@/lib/discovery/runner';

export const POST: APIRoute = async (context) => {
	const env = getEnv();
	if (!isAdminAuthed(context.request, env)) {
		return context.redirect('/admin/login');
	}

	const db = getDb();
	const form = await context.request.formData();
	const id = String(form.get('id') ?? '');
	const action = String(form.get('action') ?? '');

	if (!id) return context.redirect('/admin/proposals');

	if (action === 'reject') {
		await rejectProposal(db, id);
		return context.redirect('/admin/proposals?status=pending');
	}

	if (action === 'approve') {
		const deadlines = deadlinesFromForm(form, 6);
		await approveProposal(db, id, {
			title: String(form.get('title') ?? ''),
			funder: String(form.get('funder') ?? ''),
			eligibility_summary: String(form.get('eligibility_summary') ?? ''),
			deadlines,
			deadline_notes: String(form.get('deadline_notes') ?? '') || null,
			applicant_types: String(form.get('applicant_types') ?? 'both'),
			amount_notes: String(form.get('amount_notes') ?? '') || null,
		});
		return context.redirect('/admin/proposals?status=pending');
	}

	return context.redirect('/admin/proposals');
};
