/**
 * Paid-seeker deadline reminder prefs + idempotent cron sweep (Resend).
 * Reminder "today" is America/Toronto calendar date.
 */
import { eq } from 'drizzle-orm';
import {
	ALLOWED_REMINDER_OFFSETS,
	EntitlementError,
	isPaidSeeker,
	normalizeReminderOffsets,
	parseReminderOffsetsJson,
} from './billing';
import { todayToronto } from './deadlines';
import { getDrizzle, seekerProfiles } from './db';
import type { EmailSender } from './email';
import {
	collectDueReminders,
	type DueReminder,
	type ReminderCandidateRow,
} from './reminders-core';

export {
	collectDueReminders,
	isReminderDue,
	subtractDaysIso,
	type DueReminder,
} from './reminders-core';

export type ReminderUser = {
	id: string;
	email?: string | null;
	accountType?: string | null;
	subscriptionTier?: string | null;
};

export async function ensureSeekerProfile(db: D1Database, userId: string): Promise<void> {
	const existing = await db
		.prepare(`SELECT user_id FROM seeker_profiles WHERE user_id = ?`)
		.bind(userId)
		.first();
	if (existing) return;
	await db
		.prepare(
			`INSERT INTO seeker_profiles (user_id, reminder_offsets, weekly_digest)
       VALUES (?, ?, 0)`,
		)
		.bind(userId, JSON.stringify([...ALLOWED_REMINDER_OFFSETS]))
		.run();
}

export async function getReminderPrefs(db: D1Database, user: ReminderUser | null) {
	if (!user?.id) {
		throw new EntitlementError('AUTH_REQUIRED', 'Sign in required', 401);
	}
	if (!isPaidSeeker(user)) {
		throw new EntitlementError(
			'PAID_REQUIRED',
			'Reminder preferences require a paid seeker plan.',
			402,
		);
	}
	await ensureSeekerProfile(db, user.id);
	const row = await db
		.prepare(
			`SELECT reminder_offsets, weekly_digest FROM seeker_profiles WHERE user_id = ?`,
		)
		.bind(user.id)
		.first<{ reminder_offsets: string; weekly_digest: number }>();
	return {
		reminderOffsets: parseReminderOffsetsJson(row?.reminder_offsets),
		weeklyDigest: Boolean(row?.weekly_digest),
	};
}

export async function setReminderPrefs(
	db: D1Database,
	user: ReminderUser | null,
	input: { reminderOffsets?: unknown; weeklyDigest?: unknown },
) {
	if (!user?.id) {
		throw new EntitlementError('AUTH_REQUIRED', 'Sign in required', 401);
	}
	if (!isPaidSeeker(user)) {
		throw new EntitlementError(
			'PAID_REQUIRED',
			'Reminder preferences require a paid seeker plan.',
			402,
		);
	}
	await ensureSeekerProfile(db, user.id);

	const offsets =
		input.reminderOffsets === undefined
			? undefined
			: normalizeReminderOffsets(input.reminderOffsets);
	const weekly =
		input.weeklyDigest === undefined
			? undefined
			: input.weeklyDigest === true ||
				input.weeklyDigest === 1 ||
				input.weeklyDigest === '1' ||
				input.weeklyDigest === 'true';

	const drizzle = getDrizzle(db);
	const patch: Partial<typeof seekerProfiles.$inferInsert> = {
		updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
	};
	if (offsets) patch.reminderOffsets = JSON.stringify(offsets);
	if (weekly !== undefined) patch.weeklyDigest = weekly ? 1 : 0;

	await drizzle
		.update(seekerProfiles)
		.set(patch)
		.where(eq(seekerProfiles.userId, user.id));

	return getReminderPrefs(db, user);
}

export async function loadReminderCandidates(
	db: D1Database,
): Promise<ReminderCandidateRow[]> {
	const { results } = await db
		.prepare(
			`SELECT
        u.id AS user_id,
        u.email AS email,
        u."subscriptionTier" AS subscriptionTier,
        u."accountType" AS accountType,
        sp.reminder_offsets AS reminder_offsets,
        g.id AS grant_id,
        g.name AS grant_name,
        g.slug AS grant_slug,
        g.deadlines_json AS deadlines_json,
        g.deadline_at AS deadline_at,
        g.deadline_notes AS deadline_notes
      FROM saves s
      INNER JOIN "user" u ON u.id = s.user_id
      INNER JOIN grants g ON g.id = s.grant_id
      LEFT JOIN seeker_profiles sp ON sp.user_id = u.id
      WHERE u."subscriptionTier" = 'paid'
        AND (u."accountType" IS NULL OR u."accountType" = 'seeker')`,
		)
		.all<ReminderCandidateRow>();
	return results ?? [];
}

async function alreadySent(
	db: D1Database,
	item: Pick<DueReminder, 'userId' | 'grantId' | 'deadlineDate' | 'offsetDays'>,
): Promise<boolean> {
	const row = await db
		.prepare(
			`SELECT id FROM reminder_sends
       WHERE user_id = ? AND grant_id = ? AND deadline_date = ? AND offset_days = ?
       LIMIT 1`,
		)
		.bind(item.userId, item.grantId, item.deadlineDate, item.offsetDays)
		.first();
	return Boolean(row);
}

async function recordSend(
	db: D1Database,
	item: DueReminder,
	emailId: string,
): Promise<'inserted' | 'duplicate'> {
	const id = crypto.randomUUID();
	try {
		await db
			.prepare(
				`INSERT INTO reminder_sends (id, user_id, grant_id, deadline_date, offset_days, email_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				id,
				item.userId,
				item.grantId,
				item.deadlineDate,
				item.offsetDays,
				emailId,
			)
			.run();
		return 'inserted';
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (/UNIQUE|unique|constraint/i.test(msg)) return 'duplicate';
		throw e;
	}
}

export type ReminderSweepResult = {
	today: string;
	candidates: number;
	due: number;
	sent: number;
	skippedDuplicate: number;
	failed: number;
};

/**
 * Find due reminders for America/Toronto `today` and send via Resend (or stub).
 * Idempotent: unique (user, grant, deadline, offset) prevents double-send.
 */
export async function runReminderSweep(
	db: D1Database,
	email: EmailSender,
	opts?: { now?: Date; appUrl?: string },
): Promise<ReminderSweepResult> {
	const today = todayToronto(opts?.now ?? new Date());
	const rows = await loadReminderCandidates(db);
	const due = collectDueReminders(rows, today);
	const appUrl = (opts?.appUrl || '').replace(/\/$/, '');

	let sent = 0;
	let skippedDuplicate = 0;
	let failed = 0;

	for (const item of due) {
		if (await alreadySent(db, item)) {
			skippedDuplicate += 1;
			continue;
		}

		const link = appUrl
			? `${appUrl}/grants/${item.grantSlug}`
			: `/grants/${item.grantSlug}`;
		const subject = `Deadline in ${item.offsetDays} day${item.offsetDays === 1 ? '' : 's'}: ${item.grantName}`;
		const text = [
			`Reminder: ${item.grantName} is due on ${item.deadlineDate} (${item.offsetDays}-day notice).`,
			`View grant: ${link}`,
		].join('\n');
		const html = `<p>Reminder: <strong>${escapeHtml(item.grantName)}</strong> is due on <strong>${item.deadlineDate}</strong> (${item.offsetDays}-day notice).</p><p><a href="${link}">View grant</a></p>`;

		const result = await email.send({
			to: item.email,
			subject,
			html,
			text,
		});

		if (!result.ok) {
			failed += 1;
			console.error('[reminders] send failed', result.error);
			continue;
		}

		const record = await recordSend(db, item, result.id);
		if (record === 'duplicate') {
			skippedDuplicate += 1;
		} else {
			sent += 1;
		}
	}

	return {
		today,
		candidates: rows.length,
		due: due.length,
		sent,
		skippedDuplicate,
		failed,
	};
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
