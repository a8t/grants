/**
 * Pure reminder due-date helpers (no D1 / Cloudflare imports — unit-testable).
 */
import {
	parseReminderOffsetsJson,
	type ReminderOffset,
} from './billing';
import { deadlinesFromLegacy, parseDeadlinesJson } from './deadlines';

export type DueReminder = {
	userId: string;
	email: string;
	grantId: string;
	grantName: string;
	grantSlug: string;
	deadlineDate: string;
	offsetDays: ReminderOffset;
	idempotencyKey: string;
};

export type ReminderCandidateRow = {
	user_id: string;
	email: string;
	subscriptionTier: string;
	accountType: string;
	reminder_offsets: string | null;
	grant_id: string;
	grant_name: string;
	grant_slug: string;
	deadlines_json: string;
	deadline_at: string | null;
	deadline_notes: string | null;
};

/** Subtract whole calendar days from an ISO YYYY-MM-DD (UTC noon math). */
export function subtractDaysIso(isoDate: string, days: number): string {
	const [y, m, d] = isoDate.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	dt.setUTCDate(dt.getUTCDate() - days);
	const yy = dt.getUTCFullYear();
	const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(dt.getUTCDate()).padStart(2, '0');
	return `${yy}-${mm}-${dd}`;
}

/**
 * True when the reminder for (deadline, offset) should fire on `today`
 * (America/Toronto YYYY-MM-DD). Past deadlines never fire.
 */
export function isReminderDue(opts: {
	deadlineDate: string;
	offsetDays: number;
	today: string;
}): boolean {
	if (opts.deadlineDate < opts.today) return false;
	const dueOn = subtractDaysIso(opts.deadlineDate, opts.offsetDays);
	return dueOn === opts.today;
}

/** Pure: build due list from candidate rows + today (testable without D1). */
export function collectDueReminders(
	rows: ReminderCandidateRow[],
	today: string,
): DueReminder[] {
	const out: DueReminder[] = [];
	for (const row of rows) {
		if (row.accountType === 'writer') continue;
		if (row.subscriptionTier !== 'paid') continue;
		const offsets = parseReminderOffsetsJson(row.reminder_offsets);
		let deadlines = parseDeadlinesJson(row.deadlines_json);
		if (!deadlines.length) {
			deadlines = deadlinesFromLegacy(row.deadline_at, row.deadline_notes);
		}
		for (const dl of deadlines) {
			if (dl.date < today) continue;
			for (const offset of offsets) {
				if (!isReminderDue({ deadlineDate: dl.date, offsetDays: offset, today })) {
					continue;
				}
				out.push({
					userId: row.user_id,
					email: row.email,
					grantId: row.grant_id,
					grantName: row.grant_name,
					grantSlug: row.grant_slug,
					deadlineDate: dl.date,
					offsetDays: offset,
					idempotencyKey: `${row.user_id}:${row.grant_id}:${dl.date}:${offset}`,
				});
			}
		}
	}
	return out;
}
