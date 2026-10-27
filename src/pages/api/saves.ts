import type { APIRoute } from 'astro';
import { EntitlementError, entitlementJson, saveCapFor } from '@/lib/billing';
import { getDb } from '@/lib/db';
import { createSave, deleteSave, listUserSaves, countUserSaves } from '@/lib/saves';

export const GET: APIRoute = async (context) => {
	const user = context.locals.user;
	if (!user?.id) {
		return entitlementJson(
			new EntitlementError('AUTH_REQUIRED', 'Sign in to view saves', 401),
		);
	}
	const db = getDb();
	const items = await listUserSaves(db, user.id);
	const count = await countUserSaves(db, user.id);
	return Response.json({ items, count, cap: saveCapFor(user) });
};

export const POST: APIRoute = async (context) => {
	const user = context.locals.user;
	const db = getDb();
	try {
		const body = await readGrantId(context.request);
		const result = await createSave(db, user, body.grantId);
		return Response.json(result, { status: 201 });
	} catch (e) {
		if (e instanceof EntitlementError) return entitlementJson(e);
		throw e;
	}
};

export const DELETE: APIRoute = async (context) => {
	const user = context.locals.user;
	const db = getDb();
	try {
		const body = await readGrantId(context.request);
		const result = await deleteSave(db, user, body.grantId);
		return Response.json(result);
	} catch (e) {
		if (e instanceof EntitlementError) return entitlementJson(e);
		throw e;
	}
};

async function readGrantId(request: Request): Promise<{ grantId: string }> {
	const ct = request.headers.get('content-type') || '';
	if (ct.includes('application/json')) {
		const json = (await request.json()) as { grantId?: string };
		const grantId = String(json.grantId ?? '').trim();
		if (!grantId) {
			throw new EntitlementError('NOT_FOUND', 'grantId is required', 400);
		}
		return { grantId };
	}
	const form = await request.formData();
	const grantId = String(form.get('grantId') ?? '').trim();
	if (!grantId) {
		throw new EntitlementError('NOT_FOUND', 'grantId is required', 400);
	}
	return { grantId };
}
