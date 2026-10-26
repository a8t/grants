import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { handlePaddleWebhookEvent } from '@/lib/paddle';
import { resetAppTables } from './fixtures';

async function seedUser(id: string): Promise<void> {
	const now = Date.now();
	await env.DB.prepare(
		`INSERT INTO "user" (
      id, name, email, emailVerified, image, createdAt, updatedAt,
      accountType, seekerKind, subscriptionTier
    ) VALUES (?, 'Pat', ?, 1, NULL, ?, ?, 'seeker', 'individual', 'free')`,
	)
		.bind(id, `${id}@example.com`, now, now)
		.run();
}

describe('handlePaddleWebhookEvent (D1 entitlement mapping)', () => {
	beforeEach(async () => {
		await resetAppTables();
		await env.DB.prepare('DELETE FROM "user"').run();
	});

	it('activates seeker paid from custom_data.kind', async () => {
		await seedUser('u_seeker');
		const out = await handlePaddleWebhookEvent(
			env.DB,
			{ PADDLE_PRICE_SEEKER: 'pri_seeker', PADDLE_PRICE_WRITER: 'pri_writer' },
			{
				event_type: 'subscription.activated',
				data: {
					id: 'sub_123',
					status: 'active',
					customer_id: 'ctm_1',
					custom_data: { userId: 'u_seeker', kind: 'seeker_paid' },
				},
			},
		);
		expect(out.handled).toBe(true);
		const user = await env.DB.prepare(
			`SELECT subscriptionTier, subscriptionStatus, paddleSubscriptionId FROM "user" WHERE id = ?`,
		)
			.bind('u_seeker')
			.first<{
				subscriptionTier: string;
				subscriptionStatus: string;
				paddleSubscriptionId: string;
			}>();
		expect(user).toMatchObject({
			subscriptionTier: 'paid',
			subscriptionStatus: 'active',
			paddleSubscriptionId: 'sub_123',
		});
	});

	it('maps writer_paid via price id and lists writer profile', async () => {
		await seedUser('u_writer');
		const out = await handlePaddleWebhookEvent(
			env.DB,
			{ PADDLE_PRICE_SEEKER: 'pri_seeker', PADDLE_PRICE_WRITER: 'pri_writer' },
			{
				event_type: 'transaction.completed',
				data: {
					status: 'completed',
					customer_id: 'ctm_2',
					subscription_id: 'sub_w',
					custom_data: { userId: 'u_writer' },
					items: [{ price: { id: 'pri_writer' } }],
				},
			},
		);
		expect(out.handled).toBe(true);
		const user = await env.DB.prepare(
			`SELECT accountType, subscriptionTier FROM "user" WHERE id = ?`,
		)
			.bind('u_writer')
			.first<{ accountType: string; subscriptionTier: string }>();
		expect(user).toEqual({ accountType: 'writer', subscriptionTier: 'paid' });
		const profile = await env.DB.prepare(
			`SELECT listed FROM writer_profiles WHERE user_id = ?`,
		)
			.bind('u_writer')
			.first<{ listed: number }>();
		expect(profile?.listed).toBe(1);
	});

	it('downgrades on subscription.canceled', async () => {
		await seedUser('u_down');
		await handlePaddleWebhookEvent(
			env.DB,
			{},
			{
				event_type: 'subscription.activated',
				data: {
					id: 'sub_d',
					status: 'active',
					custom_data: { userId: 'u_down', kind: 'seeker_paid' },
				},
			},
		);
		await handlePaddleWebhookEvent(
			env.DB,
			{},
			{
				event_type: 'subscription.canceled',
				data: {
					id: 'sub_d',
					status: 'canceled',
					custom_data: { userId: 'u_down', kind: 'seeker_paid' },
				},
			},
		);
		const user = await env.DB.prepare(
			`SELECT subscriptionTier, subscriptionStatus FROM "user" WHERE id = ?`,
		)
			.bind('u_down')
			.first<{ subscriptionTier: string; subscriptionStatus: string }>();
		expect(user).toEqual({
			subscriptionTier: 'free',
			subscriptionStatus: 'canceled',
		});
	});
});
