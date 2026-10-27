import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { EntitlementError, FREE_SAVE_CAP } from '@/lib/billing';
import { createSave, countUserSaves } from '@/lib/saves';
import { resetAppTables, seedGrant, seedUser } from './fixtures';

describe('createSave paywall (D1)', () => {
	beforeEach(async () => {
		await resetAppTables();
		await env.DB.prepare('DELETE FROM "user"').run();
		for (let i = 0; i < FREE_SAVE_CAP + 2; i++) {
			await seedGrant({
				id: `g${i}`,
				slug: `grant-${i}`,
				name: `Grant ${i}`,
				deadlineAt: '2026-12-01',
				deadlinesJson: JSON.stringify([{ date: '2026-12-01' }]),
			});
		}
	});

	it('rejects guest (null user)', async () => {
		await expect(createSave(env.DB, null, 'g0')).rejects.toMatchObject({
			code: 'AUTH_REQUIRED',
			status: 401,
		});
	});

	it('allows free seeker under cap', async () => {
		await seedUser({ id: 'free1', subscriptionTier: 'free' });
		const out = await createSave(
			env.DB,
			{ id: 'free1', accountType: 'seeker', subscriptionTier: 'free' },
			'g0',
		);
		expect(out).toMatchObject({ saved: true, count: 1, cap: FREE_SAVE_CAP });
		expect(await countUserSaves(env.DB, 'free1')).toBe(1);
	});

	it('blocks free seeker at save cap with 402 SAVE_CAP', async () => {
		await seedUser({ id: 'free_cap', subscriptionTier: 'free' });
		const user = {
			id: 'free_cap',
			accountType: 'seeker',
			subscriptionTier: 'free',
		};
		for (let i = 0; i < FREE_SAVE_CAP; i++) {
			await createSave(env.DB, user, `g${i}`);
		}
		expect(await countUserSaves(env.DB, 'free_cap')).toBe(FREE_SAVE_CAP);

		try {
			await createSave(env.DB, user, `g${FREE_SAVE_CAP}`);
			expect.unreachable('should throw');
		} catch (e) {
			expect(e).toBeInstanceOf(EntitlementError);
			expect(e).toMatchObject({
				code: 'SAVE_CAP',
				status: 402,
				details: { cap: FREE_SAVE_CAP, count: FREE_SAVE_CAP },
			});
		}
	});

	it('allows paid seeker beyond free cap (unlimited)', async () => {
		await seedUser({ id: 'paid1', subscriptionTier: 'paid' });
		const user = {
			id: 'paid1',
			accountType: 'seeker',
			subscriptionTier: 'paid',
		};
		for (let i = 0; i < FREE_SAVE_CAP + 2; i++) {
			await createSave(env.DB, user, `g${i}`);
		}
		expect(await countUserSaves(env.DB, 'paid1')).toBe(FREE_SAVE_CAP + 2);
	});

	it('re-saving existing grant does not consume another slot', async () => {
		await seedUser({ id: 'free2', subscriptionTier: 'free' });
		const user = {
			id: 'free2',
			accountType: 'seeker',
			subscriptionTier: 'free',
		};
		await createSave(env.DB, user, 'g0');
		const again = await createSave(env.DB, user, 'g0');
		expect(again.count).toBe(1);
		expect(await countUserSaves(env.DB, 'free2')).toBe(1);
	});
});
