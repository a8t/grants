import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { approveProposal, rejectProposal } from '@/lib/discovery/runner';
import { getGrantBySlug } from '@/lib/grants';
import { resetAppTables, seedSourceAndProposal } from './fixtures';

describe('approveProposal / rejectProposal (D1)', () => {
	beforeEach(async () => {
		await resetAppTables();
	});

	it('publishes a pending proposal into grants and marks approved', async () => {
		const { proposalId } = await seedSourceAndProposal({
			title: 'Fresh Discovery Grant',
			deadlinesJson: JSON.stringify([{ date: '2026-11-01', label: 'intake 1' }]),
		});

		const result = await approveProposal(env.DB, proposalId, {
			eligibility_summary: 'Edited eligibility',
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const grant = await getGrantBySlug(env.DB, 'fresh-discovery-grant');
		expect(grant).toMatchObject({
			id: result.grantId,
			name: 'Fresh Discovery Grant',
			eligibility_summary: 'Edited eligibility',
			deadline_at: '2026-11-01',
			status: 'open',
		});

		const proposal = await env.DB.prepare(
			`SELECT status, published_grant_id FROM grant_proposals WHERE id = ?`,
		)
			.bind(proposalId)
			.first<{ status: string; published_grant_id: string }>();
		expect(proposal).toEqual({
			status: 'approved',
			published_grant_id: result.grantId,
		});

		const again = await approveProposal(env.DB, proposalId);
		expect(again).toEqual({ ok: false, error: 'Already approved' });
	});

	it('rejects a pending proposal', async () => {
		const { proposalId } = await seedSourceAndProposal({ proposalId: 'prop_reject' });
		expect(await rejectProposal(env.DB, proposalId)).toEqual({ ok: true });
		const row = await env.DB.prepare(`SELECT status FROM grant_proposals WHERE id = ?`)
			.bind(proposalId)
			.first<{ status: string }>();
		expect(row?.status).toBe('rejected');
		expect(await rejectProposal(env.DB, proposalId)).toEqual({
			ok: false,
			error: 'Proposal not pending',
		});
	});
});
