import { describe, expect, it } from 'vitest';
import { todayToronto } from '@/lib/deadlines';
import {
	collectDueReminders,
	isReminderDue,
	subtractDaysIso,
} from '@/lib/reminders-core';

describe('subtractDaysIso / isReminderDue', () => {
	it('subtracts calendar days across month boundaries', () => {
		expect(subtractDaysIso('2026-03-01', 1)).toBe('2026-02-28');
		expect(subtractDaysIso('2026-03-15', 14)).toBe('2026-03-01');
	});

	it('fires only when today equals deadline minus offset', () => {
		expect(
			isReminderDue({ deadlineDate: '2026-04-15', offsetDays: 7, today: '2026-04-08' }),
		).toBe(true);
		expect(
			isReminderDue({ deadlineDate: '2026-04-15', offsetDays: 7, today: '2026-04-07' }),
		).toBe(false);
		expect(
			isReminderDue({ deadlineDate: '2026-04-15', offsetDays: 7, today: '2026-04-09' }),
		).toBe(false);
	});

	it('never fires for past deadlines', () => {
		expect(
			isReminderDue({ deadlineDate: '2026-01-01', offsetDays: 1, today: '2026-04-01' }),
		).toBe(false);
		expect(
			isReminderDue({ deadlineDate: '2026-03-31', offsetDays: 0, today: '2026-04-01' }),
		).toBe(false);
	});
});

describe('America/Toronto timezone boundary', () => {
	it('todayToronto flips on Toronto midnight, not UTC', () => {
		// 2026-06-15 03:30 UTC = 2026-06-14 23:30 EDT (UTC-4)
		const stillSundayToronto = new Date('2026-06-15T03:30:00.000Z');
		expect(todayToronto(stillSundayToronto)).toBe('2026-06-14');

		// 2026-06-15 04:30 UTC = 2026-06-15 00:30 EDT
		const mondayToronto = new Date('2026-06-15T04:30:00.000Z');
		expect(todayToronto(mondayToronto)).toBe('2026-06-15');
	});

	it('due calculation uses the Toronto calendar day from now', () => {
		const now = new Date('2026-06-15T03:30:00.000Z'); // still 2026-06-14 in Toronto
		const today = todayToronto(now);
		expect(today).toBe('2026-06-14');
		// Deadline 2026-06-21 → 7-day reminder due on 2026-06-14
		expect(
			isReminderDue({ deadlineDate: '2026-06-21', offsetDays: 7, today }),
		).toBe(true);
		// Would NOT be due if we wrongly used UTC date 2026-06-15
		expect(
			isReminderDue({
				deadlineDate: '2026-06-21',
				offsetDays: 7,
				today: '2026-06-15',
			}),
		).toBe(false);
	});
});

describe('collectDueReminders', () => {
	const base = {
		user_id: 'u1',
		email: 'u1@example.com',
		subscriptionTier: 'paid',
		accountType: 'seeker',
		reminder_offsets: '[14,7,3,1]',
		grant_id: 'g1',
		grant_name: 'Arts Grant',
		grant_slug: 'arts-grant',
		deadlines_json: JSON.stringify([{ date: '2026-04-15', label: 'final' }]),
		deadline_at: null,
		deadline_notes: null,
	};

	it('includes due offset for paid seeker', () => {
		const due = collectDueReminders([base], '2026-04-08'); // 7 days before
		expect(due).toHaveLength(1);
		expect(due[0]).toMatchObject({
			offsetDays: 7,
			deadlineDate: '2026-04-15',
			idempotencyKey: 'u1:g1:2026-04-15:7',
		});
	});

	it('skips free seekers and writers', () => {
		expect(
			collectDueReminders([{ ...base, subscriptionTier: 'free' }], '2026-04-08'),
		).toHaveLength(0);
		expect(
			collectDueReminders([{ ...base, accountType: 'writer' }], '2026-04-08'),
		).toHaveLength(0);
	});

	it('skips past deadlines even if offset math would match', () => {
		const past = {
			...base,
			deadlines_json: JSON.stringify([{ date: '2026-01-01' }]),
		};
		// offset 14 from Jan 1 = Dec 18 prior year — not relevant; today is Apr
		expect(collectDueReminders([past], '2026-04-08')).toHaveLength(0);
	});

	it('skips when not due today', () => {
		// April 2 is not 14/7/3/1 days before April 15
		expect(collectDueReminders([base], '2026-04-02')).toHaveLength(0);
	});
});
