import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { EntitlementError } from '@/lib/billing';
import type { EmailMessage, EmailSendResult, EmailSender } from '@/lib/email';
import {
	getReminderPrefs,
	runReminderSweep,
	setReminderPrefs,
} from '@/lib/reminders';
import { resetAppTables, seedGrant, seedUser } from './fixtures';

function mockEmail(): EmailSender & { sent: EmailMessage[] } {
	const sent: EmailMessage[] = [];
	return {
		sent,
		async send(message): Promise<EmailSendResult> {
			sent.push(message);
			return { ok: true, id: `msg_${sent.length}`, stubbed: true };
		},
	};
}

describe('reminder prefs paywall', () => {
	beforeEach(async () => {
		await resetAppTables();
		await env.DB.prepare('DELETE FROM "user"').run();
	});

	it('rejects free seeker prefs with PAID_REQUIRED 402', async () => {
		await seedUser({ id: 'free_r', subscriptionTier: 'free' });
		await expect(
			getReminderPrefs(env.DB, {
				id: 'free_r',
				accountType: 'seeker',
				subscriptionTier: 'free',
			}),
		).rejects.toMatchObject({ code: 'PAID_REQUIRED', status: 402 });

		await expect(
			setReminderPrefs(
				env.DB,
				{ id: 'free_r', accountType: 'seeker', subscriptionTier: 'free' },
				{ reminderOffsets: [7, 1] },
			),
		).rejects.toBeInstanceOf(EntitlementError);
	});

	it('allows paid seeker to set offsets', async () => {
		await seedUser({ id: 'paid_r', subscriptionTier: 'paid' });
		const prefs = await setReminderPrefs(
			env.DB,
			{ id: 'paid_r', accountType: 'seeker', subscriptionTier: 'paid' },
			{ reminderOffsets: [14, 3], weeklyDigest: true },
		);
		expect(prefs.reminderOffsets).toEqual([14, 3]);
		expect(prefs.weeklyDigest).toBe(true);
	});
});

describe('runReminderSweep cron', () => {
	beforeEach(async () => {
		await resetAppTables();
		await env.DB.prepare('DELETE FROM "user"').run();
	});

	async function seedPaidWithSave(opts: {
		userId: string;
		grantId: string;
		deadline: string;
		offsets?: number[];
	}) {
		await seedUser({ id: opts.userId, subscriptionTier: 'paid' });
		await seedGrant({
			id: opts.grantId,
			slug: `slug-${opts.grantId}`,
			name: `Grant ${opts.grantId}`,
			deadlineAt: opts.deadline,
			deadlinesJson: JSON.stringify([{ date: opts.deadline }]),
		});
		await env.DB.prepare(
			`INSERT INTO seeker_profiles (user_id, reminder_offsets, weekly_digest)
       VALUES (?, ?, 0)`,
		)
			.bind(opts.userId, JSON.stringify(opts.offsets ?? [14, 7, 3, 1]))
			.run();
		await env.DB.prepare(`INSERT INTO saves (user_id, grant_id) VALUES (?, ?)`)
			.bind(opts.userId, opts.grantId)
			.run();
	}

	it('sends when due today (7-day offset)', async () => {
		await seedPaidWithSave({
			userId: 'u_due',
			grantId: 'g_due',
			deadline: '2026-04-15',
			offsets: [7],
		});
		const mail = mockEmail();
		// Toronto-safe noon UTC on 2026-04-08
		const result = await runReminderSweep(env.DB, mail, {
			now: new Date('2026-04-08T16:00:00.000Z'),
			appUrl: 'https://example.test',
		});
		expect(result.today).toBe('2026-04-08');
		expect(result.sent).toBe(1);
		expect(mail.sent).toHaveLength(1);
		expect(mail.sent[0].to).toBe('u_due@example.com');
		expect(mail.sent[0].subject).toContain('7 day');
	});

	it('does not send when not due', async () => {
		await seedPaidWithSave({
			userId: 'u_nd',
			grantId: 'g_nd',
			deadline: '2026-04-15',
			offsets: [7],
		});
		const mail = mockEmail();
		const result = await runReminderSweep(env.DB, mail, {
			now: new Date('2026-04-01T16:00:00.000Z'),
		});
		expect(result.sent).toBe(0);
		expect(mail.sent).toHaveLength(0);
	});

	it('skips past deadlines', async () => {
		await seedPaidWithSave({
			userId: 'u_past',
			grantId: 'g_past',
			deadline: '2026-01-10',
			offsets: [1],
		});
		const mail = mockEmail();
		const result = await runReminderSweep(env.DB, mail, {
			now: new Date('2026-04-08T16:00:00.000Z'),
		});
		expect(result.due).toBe(0);
		expect(result.sent).toBe(0);
	});

	it('prevents duplicate sends on second cron tick', async () => {
		await seedPaidWithSave({
			userId: 'u_dup',
			grantId: 'g_dup',
			deadline: '2026-04-15',
			offsets: [7],
		});
		const mail = mockEmail();
		const now = new Date('2026-04-08T16:00:00.000Z');
		const first = await runReminderSweep(env.DB, mail, { now });
		const second = await runReminderSweep(env.DB, mail, { now });
		expect(first.sent).toBe(1);
		expect(second.sent).toBe(0);
		expect(second.skippedDuplicate).toBe(1);
		expect(mail.sent).toHaveLength(1);

		const rows = await env.DB.prepare(
			`SELECT COUNT(*) AS n FROM reminder_sends WHERE user_id = ?`,
		)
			.bind('u_dup')
			.first<{ n: number }>();
		expect(Number(rows?.n)).toBe(1);
	});

	it('uses America/Toronto date across UTC midnight boundary', async () => {
		await seedPaidWithSave({
			userId: 'u_tz',
			grantId: 'g_tz',
			deadline: '2026-06-21',
			offsets: [7],
		});
		const mail = mockEmail();
		// 2026-06-15 03:30 UTC → still 2026-06-14 in Toronto → due for 7-day
		const result = await runReminderSweep(env.DB, mail, {
			now: new Date('2026-06-15T03:30:00.000Z'),
		});
		expect(result.today).toBe('2026-06-14');
		expect(result.sent).toBe(1);
	});
});
