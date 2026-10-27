import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { EntitlementError } from '@/lib/billing';
import { applyDowngrade, handlePaddleWebhookEvent } from '@/lib/paddle';
import { createWriterLead } from '@/lib/leads';
import { getCalendarSaves } from '@/lib/saves';
import { resetAppTables, seedGrant, seedUser } from './fixtures';

describe('writer leads listed vs unlisted', () => {
	beforeEach(async () => {
		await resetAppTables();
		await env.DB.prepare('DELETE FROM "user"').run();
	});

	it('allows lead to listed paid writer', async () => {
		await seedUser({ id: 'seeker1', subscriptionTier: 'free' });
		await seedUser({
			id: 'writer1',
			accountType: 'writer',
			subscriptionTier: 'paid',
			email: 'writer1@example.com',
		});
		await env.DB.prepare(
			`INSERT INTO writer_profiles (
        user_id, display_name, disciplines, provinces, bio, listed
      ) VALUES (?, 'W One', '[]', '["ON"]', 'Bio', 1)`,
		)
			.bind('writer1')
			.run();

		const out = await createWriterLead(env.DB, {
			seeker: { id: 'seeker1', email: 'seeker1@example.com', name: 'Seeker' },
			writerUserId: 'writer1',
			message: 'Need help with OAC.',
		});
		expect(out.writerUserId).toBe('writer1');
		expect(out.emailed).toBe(true);

		const lead = await env.DB.prepare(
			`SELECT message FROM writer_leads WHERE writer_user_id = ?`,
		)
			.bind('writer1')
			.first<{ message: string }>();
		expect(lead?.message).toContain('OAC');
	});

	it('rejects lead to unlisted writer with 403', async () => {
		await seedUser({ id: 'seeker2' });
		await seedUser({
			id: 'writer2',
			accountType: 'writer',
			subscriptionTier: 'free',
		});
		await env.DB.prepare(
			`INSERT INTO writer_profiles (
        user_id, display_name, disciplines, provinces, bio, listed
      ) VALUES (?, 'W Two', '[]', '["ON"]', 'Bio', 0)`,
		)
			.bind('writer2')
			.run();

		await expect(
			createWriterLead(env.DB, {
				seeker: { id: 'seeker2', email: 's@example.com' },
				writerUserId: 'writer2',
				message: 'Hello',
			}),
		).rejects.toMatchObject({ code: 'WRITER_NOT_LISTED', status: 403 });
	});

	it('canceled subscription unlists writer and blocks leads', async () => {
		await seedUser({ id: 'seeker3' });
		await seedUser({
			id: 'writer3',
			accountType: 'writer',
			subscriptionTier: 'paid',
		});
		await env.DB.prepare(
			`INSERT INTO writer_profiles (
        user_id, display_name, disciplines, provinces, bio, listed
      ) VALUES (?, 'W Three', '[]', '["ON"]', 'Bio', 1)`,
		)
			.bind('writer3')
			.run();

		await applyDowngrade(env.DB, {
			userId: 'writer3',
			status: 'canceled',
		});

		const user = await env.DB.prepare(
			`SELECT subscriptionTier FROM "user" WHERE id = ?`,
		)
			.bind('writer3')
			.first<{ subscriptionTier: string }>();
		expect(user?.subscriptionTier).toBe('free');
		const profile = await env.DB.prepare(
			`SELECT listed FROM writer_profiles WHERE user_id = ?`,
		)
			.bind('writer3')
			.first<{ listed: number }>();
		expect(profile?.listed).toBe(0);

		await expect(
			createWriterLead(env.DB, {
				seeker: { id: 'seeker3', email: 's3@example.com' },
				writerUserId: 'writer3',
				message: 'Still there?',
			}),
		).rejects.toBeInstanceOf(EntitlementError);
	});
});

describe('canceled seeker loses paid calendar entitlement', () => {
	beforeEach(async () => {
		await resetAppTables();
		await env.DB.prepare('DELETE FROM "user"').run();
	});

	it('webhook cancel → calendar PAID_REQUIRED', async () => {
		await seedUser({ id: 'u_cal', subscriptionTier: 'paid' });
		await seedGrant({
			id: 'g_cal',
			slug: 'cal-grant',
			name: 'Cal Grant',
			deadlineAt: '2026-09-01',
			deadlinesJson: JSON.stringify([{ date: '2026-09-01' }]),
		});
		await env.DB.prepare(`INSERT INTO saves (user_id, grant_id) VALUES (?, ?)`)
			.bind('u_cal', 'g_cal')
			.run();

		await handlePaddleWebhookEvent(
			env.DB,
			{},
			{
				event_type: 'subscription.canceled',
				data: {
					id: 'sub_cal',
					status: 'canceled',
					custom_data: { userId: 'u_cal', kind: 'seeker_paid' },
				},
			},
		);

		const tier = await env.DB.prepare(
			`SELECT subscriptionTier, subscriptionStatus FROM "user" WHERE id = ?`,
		)
			.bind('u_cal')
			.first<{ subscriptionTier: string; subscriptionStatus: string }>();
		expect(tier).toEqual({
			subscriptionTier: 'free',
			subscriptionStatus: 'canceled',
		});

		await expect(
			getCalendarSaves(env.DB, {
				id: 'u_cal',
				accountType: 'seeker',
				subscriptionTier: 'free',
			}),
		).rejects.toMatchObject({ code: 'PAID_REQUIRED', status: 402 });
	});
});
