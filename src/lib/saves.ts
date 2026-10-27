/**
 * Grant saves with guest/free/paid paywall enforcement.
 */
import { and, count, eq } from 'drizzle-orm';
import {
	EntitlementError,
	isPaidSeeker,
	saveCapFor,
} from './billing';
import { getDrizzle, grants, saves } from './db';

export type SaveUser = {
	id: string;
	accountType?: string | null;
	subscriptionTier?: string | null;
};

export async function countUserSaves(db: D1Database, userId: string): Promise<number> {
	const drizzle = getDrizzle(db);
	const rows = await drizzle
		.select({ n: count() })
		.from(saves)
		.where(eq(saves.userId, userId));
	return Number(rows[0]?.n ?? 0);
}

export async function listUserSaves(db: D1Database, userId: string) {
	const drizzle = getDrizzle(db);
	return drizzle
		.select({
			grantId: saves.grantId,
			createdAt: saves.createdAt,
			slug: grants.slug,
			name: grants.name,
			funder: grants.funder,
			deadlineAt: grants.deadlineAt,
			deadlineNotes: grants.deadlineNotes,
			deadlinesJson: grants.deadlinesJson,
			status: grants.status,
			url: grants.url,
		})
		.from(saves)
		.innerJoin(grants, eq(saves.grantId, grants.id))
		.where(eq(saves.userId, userId));
}

export async function hasSave(
	db: D1Database,
	userId: string,
	grantId: string,
): Promise<boolean> {
	const drizzle = getDrizzle(db);
	const row = await drizzle
		.select({ grantId: saves.grantId })
		.from(saves)
		.where(and(eq(saves.userId, userId), eq(saves.grantId, grantId)))
		.limit(1);
	return row.length > 0;
}

/**
 * Persist a save. Guests must be rejected by the caller (no user).
 * Free seekers hit SAVE_CAP (402) when at FREE_SAVE_CAP.
 * Paid seekers (and listed writers) are unlimited.
 * Re-saving an existing grant is a no-op success.
 */
export async function createSave(
	db: D1Database,
	user: SaveUser | null,
	grantId: string,
): Promise<{ saved: true; count: number; cap: number | null }> {
	if (!user?.id) {
		throw new EntitlementError('AUTH_REQUIRED', 'Sign in to save grants', 401);
	}

	const grant = await db
		.prepare(`SELECT id FROM grants WHERE id = ? LIMIT 1`)
		.bind(grantId)
		.first<{ id: string }>();
	if (!grant) {
		throw new EntitlementError('NOT_FOUND', 'Grant not found', 404);
	}

	if (await hasSave(db, user.id, grantId)) {
		const n = await countUserSaves(db, user.id);
		return { saved: true, count: n, cap: saveCapFor(user) };
	}

	const cap = saveCapFor(user);
	const current = await countUserSaves(db, user.id);
	if (cap !== null && current >= cap) {
		throw new EntitlementError(
			'SAVE_CAP',
			`Free accounts can save up to ${cap} grants. Upgrade for unlimited saves.`,
			402,
			{ cap, count: current },
		);
	}

	const drizzle = getDrizzle(db);
	await drizzle.insert(saves).values({ userId: user.id, grantId });
	return { saved: true, count: current + 1, cap };
}

export async function deleteSave(
	db: D1Database,
	user: SaveUser | null,
	grantId: string,
): Promise<{ deleted: boolean; count: number; cap: number | null }> {
	if (!user?.id) {
		throw new EntitlementError('AUTH_REQUIRED', 'Sign in to manage saves', 401);
	}
	const drizzle = getDrizzle(db);
	await drizzle
		.delete(saves)
		.where(and(eq(saves.userId, user.id), eq(saves.grantId, grantId)));
	const n = await countUserSaves(db, user.id);
	return { deleted: true, count: n, cap: saveCapFor(user) };
}

/** Calendar feed — paid seekers only. */
export async function getCalendarSaves(db: D1Database, user: SaveUser | null) {
	if (!user?.id) {
		throw new EntitlementError('AUTH_REQUIRED', 'Sign in required', 401);
	}
	if (!isPaidSeeker(user)) {
		throw new EntitlementError(
			'PAID_REQUIRED',
			'Deadline calendar is a paid seeker feature. Upgrade to unlock.',
			402,
		);
	}
	return listUserSaves(db, user.id);
}
