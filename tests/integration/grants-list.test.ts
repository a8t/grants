import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { listGrants, getGrantBySlug } from '@/lib/grants';
import { resetAppTables, seedGrant } from './fixtures';

describe('listGrants / getGrantBySlug (D1)', () => {
	beforeEach(async () => {
		await resetAppTables();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-15T16:00:00Z')); // afternoon Toronto = 2026-06-15
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('lists open ON grants and excludes closed / notes-only by default', async () => {
		await seedGrant({
			id: 'g_open',
			slug: 'open-grant',
			name: 'Open Grant',
			deadlineAt: '2026-07-01',
			deadlinesJson: JSON.stringify([{ date: '2026-07-01' }]),
		});
		await seedGrant({
			id: 'g_closed',
			slug: 'closed-grant',
			name: 'Closed Grant',
			deadlineAt: '2026-01-01',
			deadlinesJson: JSON.stringify([{ date: '2026-01-01' }]),
		});
		await seedGrant({
			id: 'g_notes',
			slug: 'notes-only',
			name: 'Notes Only',
			deadlineAt: null,
			deadlinesJson: '[]',
		});
		await seedGrant({
			id: 'g_rolling',
			slug: 'rolling-grant',
			name: 'Rolling Grant',
			deadlineAt: null,
			deadlinesJson: '[]',
			status: 'rolling',
		});

		const open = await listGrants(env.DB, { province: 'ON' });
		const names = open.map((g) => g.name).sort();
		expect(names).toEqual(['Open Grant', 'Rolling Grant']);

		const closed = await listGrants(env.DB, { province: 'ON', status: 'closed' });
		expect(closed.map((g) => g.slug)).toEqual(['closed-grant']);
	});

	it('filters by applicant type and text query', async () => {
		await seedGrant({
			id: 'g_ind',
			slug: 'ind-grant',
			name: 'Individual Music Award',
			deadlineAt: '2026-08-01',
			deadlinesJson: JSON.stringify([{ date: '2026-08-01' }]),
			applicantTypes: 'individual',
		});
		await seedGrant({
			id: 'g_org',
			slug: 'org-grant',
			name: 'Org Theatre Award',
			deadlineAt: '2026-08-01',
			deadlinesJson: JSON.stringify([{ date: '2026-08-01' }]),
			applicantTypes: 'organization',
		});

		const ind = await listGrants(env.DB, { applicant: 'individual' });
		expect(ind.map((g) => g.slug)).toEqual(['ind-grant']);

		const q = await listGrants(env.DB, { q: 'theatre' });
		expect(q.map((g) => g.slug)).toEqual(['org-grant']);
	});

	it('getGrantBySlug returns snake_case Grant shape', async () => {
		await seedGrant({
			id: 'g1',
			slug: 'detail-slug',
			name: 'Detail',
			deadlineAt: '2026-10-01',
			deadlinesJson: JSON.stringify([{ date: '2026-10-01', label: 'final' }]),
		});
		const row = await getGrantBySlug(env.DB, 'detail-slug');
		expect(row).toMatchObject({
			id: 'g1',
			slug: 'detail-slug',
			name: 'Detail',
			applicant_types: 'both',
			province_scope: 'ON',
		});
		expect(await getGrantBySlug(env.DB, 'missing')).toBeNull();
	});
});
