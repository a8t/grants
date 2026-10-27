import { env } from 'cloudflare:test';

/** Wipe app tables between tests (auth tables unused here). */
export async function resetAppTables(): Promise<void> {
	const db = env.DB;
	await db.batch([
		db.prepare('DELETE FROM grant_proposals'),
		db.prepare('DELETE FROM grant_sources'),
		db.prepare('DELETE FROM saves'),
		db.prepare('DELETE FROM writer_profiles'),
		db.prepare('DELETE FROM seeker_profiles'),
		db.prepare('DELETE FROM grants'),
	]);
}

export async function seedGrant(opts: {
	id: string;
	slug: string;
	name: string;
	deadlineAt?: string | null;
	deadlinesJson?: string;
	status?: string;
	applicantTypes?: string;
	provinceScope?: string;
}): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO grants (
      id, slug, name, funder, applicant_types, eligibility_summary,
      amount_min, amount_max, amount_notes, deadline_at, deadline_notes, deadlines_json,
      url, province_scope, disciplines, status
    ) VALUES (?, ?, ?, 'Test Funder', ?, 'Eligibility', NULL, NULL, NULL, ?, NULL, ?,
      'https://example.com/g', ?, '["music"]', ?)`,
	)
		.bind(
			opts.id,
			opts.slug,
			opts.name,
			opts.applicantTypes ?? 'both',
			opts.deadlineAt ?? null,
			opts.deadlinesJson ?? '[]',
			opts.provinceScope ?? 'ON',
			opts.status ?? 'open',
		)
		.run();
}

export async function seedSourceAndProposal(opts?: {
	proposalId?: string;
	title?: string;
	deadlinesJson?: string;
}): Promise<{ sourceId: string; proposalId: string }> {
	const sourceId = 'src_test';
	const proposalId = opts?.proposalId ?? 'prop_test';
	await env.DB.prepare(
		`INSERT INTO grant_sources (id, name, base_url, adapter_key, enabled)
     VALUES (?, 'Test Source', 'https://example.com', 'test_adapter', 1)`,
	)
		.bind(sourceId)
		.run();

	await env.DB.prepare(
		`INSERT INTO grant_proposals (
      id, source_id, title, funder, url, deadline_at, deadline_notes, deadlines_json,
      raw_excerpt, applicant_types, amount_notes, province_scope, disciplines,
      dedupe_key, status
    ) VALUES (?, ?, ?, 'Test Funder', 'https://example.com/proposal', NULL, NULL, ?,
      'Excerpt eligibility', 'both', NULL, 'ON', '["music"]', ?, 'pending')`,
	)
		.bind(
			proposalId,
			sourceId,
			opts?.title ?? 'Approve Me Grant',
			opts?.deadlinesJson ?? JSON.stringify([{ date: '2026-09-01', label: 'final' }]),
			`test:${proposalId}`,
		)
		.run();

	return { sourceId, proposalId };
}
