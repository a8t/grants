import type { APIRoute } from 'astro';
import { EntitlementError, entitlementJson } from '@/lib/billing';
import { getDb } from '@/lib/db';
import { grantDeadlines } from '@/lib/grants';
import { getCalendarSaves } from '@/lib/saves';
import type { Grant } from '@/lib/types';

export const GET: APIRoute = async (context) => {
	try {
		const rows = await getCalendarSaves(getDb(), context.locals.user);
		const items = rows.map((row) => {
			const grantLike = {
				deadline_at: row.deadlineAt,
				deadline_notes: row.deadlineNotes,
				deadlines_json: row.deadlinesJson,
				status: row.status,
			} as Grant;
			return {
				grantId: row.grantId,
				slug: row.slug,
				name: row.name,
				funder: row.funder,
				status: row.status,
				url: row.url,
				savedAt: row.createdAt,
				deadlines: grantDeadlines(grantLike),
			};
		});
		return Response.json({ items });
	} catch (e) {
		if (e instanceof EntitlementError) return entitlementJson(e);
		throw e;
	}
};
