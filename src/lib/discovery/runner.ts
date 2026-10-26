import { getAdapter } from './adapters';
import type { DiscoveredGrant } from './types';
import { slugify } from './fetch';

export type SourceRow = {
	id: string;
	name: string;
	adapter_key: string;
	enabled: number;
};

export type RunSummary = {
	sourceId: string;
	adapterKey: string;
	ok: boolean;
	found: number;
	upserted: number;
	skipped: number;
	error?: string;
};

async function upsertProposal(
	db: D1Database,
	sourceId: string,
	item: DiscoveredGrant,
): Promise<'upserted' | 'skipped'> {
	const existing = await db
		.prepare(
			`SELECT id, status FROM grant_proposals WHERE dedupe_key = ? LIMIT 1`,
		)
		.bind(item.dedupeKey)
		.first<{ id: string; status: string }>();

	if (existing) {
		if (existing.status === 'rejected' || existing.status === 'approved') {
			return 'skipped';
		}
		await db
			.prepare(
				`UPDATE grant_proposals SET
          title = ?, funder = ?, url = ?, deadline_at = ?, deadline_notes = ?,
          raw_excerpt = ?, applicant_types = ?, amount_notes = ?, province_scope = ?,
          disciplines = ?, updated_at = datetime('now')
         WHERE id = ? AND status = 'pending'`,
			)
			.bind(
				item.title,
				item.funder,
				item.url,
				item.deadlineAt ?? null,
				item.deadlineNotes ?? null,
				item.rawExcerpt ?? null,
				item.applicantTypes ?? 'both',
				item.amountNotes ?? null,
				item.provinceScope ?? 'ON',
				JSON.stringify(item.disciplines ?? []),
				existing.id,
			)
			.run();
		return 'upserted';
	}

	const id = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO grant_proposals (
        id, source_id, title, funder, url, deadline_at, deadline_notes, raw_excerpt,
        applicant_types, amount_notes, province_scope, disciplines, dedupe_key, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
		)
		.bind(
			id,
			sourceId,
			item.title,
			item.funder,
			item.url,
			item.deadlineAt ?? null,
			item.deadlineNotes ?? null,
			item.rawExcerpt ?? null,
			item.applicantTypes ?? 'both',
			item.amountNotes ?? null,
			item.provinceScope ?? 'ON',
			JSON.stringify(item.disciplines ?? []),
			item.dedupeKey,
		)
		.run();
	return 'upserted';
}

export async function runSource(
	db: D1Database,
	source: SourceRow,
): Promise<RunSummary> {
	const adapter = getAdapter(source.adapter_key);
	if (!adapter) {
		const error = `Unknown adapter: ${source.adapter_key}`;
		await db
			.prepare(
				`UPDATE grant_sources SET last_run_at = datetime('now'), last_status = 'error', last_error = ?, updated_at = datetime('now') WHERE id = ?`,
			)
			.bind(error, source.id)
			.run();
		return {
			sourceId: source.id,
			adapterKey: source.adapter_key,
			ok: false,
			found: 0,
			upserted: 0,
			skipped: 0,
			error,
		};
	}

	try {
		const result = await adapter.discover();
		if (!result.ok) {
			await db
				.prepare(
					`UPDATE grant_sources SET last_run_at = datetime('now'), last_status = 'error', last_error = ?, last_found = 0, updated_at = datetime('now') WHERE id = ?`,
				)
				.bind(result.error ?? 'adapter failed', source.id)
				.run();
			return {
				sourceId: source.id,
				adapterKey: source.adapter_key,
				ok: false,
				found: 0,
				upserted: 0,
				skipped: 0,
				error: result.error,
			};
		}

		let upserted = 0;
		let skipped = 0;
		for (const item of result.items) {
			const outcome = await upsertProposal(db, source.id, item);
			if (outcome === 'upserted') upserted += 1;
			else skipped += 1;
		}

		await db
			.prepare(
				`UPDATE grant_sources SET last_run_at = datetime('now'), last_status = 'ok', last_error = NULL, last_found = ?, updated_at = datetime('now') WHERE id = ?`,
			)
			.bind(result.items.length, source.id)
			.run();

		return {
			sourceId: source.id,
			adapterKey: source.adapter_key,
			ok: true,
			found: result.items.length,
			upserted,
			skipped,
		};
	} catch (e) {
		const error = e instanceof Error ? e.message : 'run failed';
		await db
			.prepare(
				`UPDATE grant_sources SET last_run_at = datetime('now'), last_status = 'error', last_error = ?, updated_at = datetime('now') WHERE id = ?`,
			)
			.bind(error, source.id)
			.run();
		return {
			sourceId: source.id,
			adapterKey: source.adapter_key,
			ok: false,
			found: 0,
			upserted: 0,
			skipped: 0,
			error,
		};
	}
}

export async function runAllEnabledSources(db: D1Database): Promise<RunSummary[]> {
	const rows = await db
		.prepare(
			`SELECT id, name, adapter_key, enabled FROM grant_sources WHERE enabled = 1 ORDER BY name`,
		)
		.all<SourceRow>();
	const summaries: RunSummary[] = [];
	for (const source of rows.results ?? []) {
		summaries.push(await runSource(db, source));
	}
	return summaries;
}

export async function approveProposal(
	db: D1Database,
	proposalId: string,
	edits?: {
		title?: string;
		funder?: string;
		url?: string;
		deadline_at?: string | null;
		deadline_notes?: string | null;
		eligibility_summary?: string;
		applicant_types?: string;
		province_scope?: string;
		amount_notes?: string | null;
		disciplines?: string;
	},
): Promise<{ ok: true; grantId: string } | { ok: false; error: string }> {
	const proposal = await db
		.prepare(`SELECT * FROM grant_proposals WHERE id = ?`)
		.bind(proposalId)
		.first<{
			id: string;
			title: string;
			funder: string;
			url: string;
			deadline_at: string | null;
			deadline_notes: string | null;
			raw_excerpt: string | null;
			applicant_types: string;
			amount_notes: string | null;
			province_scope: string;
			disciplines: string;
			status: string;
			llm_extract_json: string | null;
		}>();

	if (!proposal) return { ok: false, error: 'Proposal not found' };
	if (proposal.status === 'approved') return { ok: false, error: 'Already approved' };

	let amountMin: number | null = null;
	let amountMax: number | null = null;
	if (proposal.llm_extract_json) {
		try {
			const ex = JSON.parse(proposal.llm_extract_json) as {
				amount_min?: number | null;
				amount_max?: number | null;
			};
			amountMin = typeof ex.amount_min === 'number' ? ex.amount_min : null;
			amountMax = typeof ex.amount_max === 'number' ? ex.amount_max : null;
		} catch {
			/* ignore */
		}
	}

	const title = edits?.title?.trim() || proposal.title;
	const funder = edits?.funder?.trim() || proposal.funder;
	const url = edits?.url?.trim() || proposal.url;
	const deadline_at =
		edits && 'deadline_at' in edits ? edits.deadline_at ?? null : proposal.deadline_at;
	const deadline_notes =
		edits && 'deadline_notes' in edits
			? edits.deadline_notes ?? null
			: proposal.deadline_notes;
	const eligibility =
		edits?.eligibility_summary?.trim() ||
		proposal.raw_excerpt ||
		'See funder program page for full eligibility.';
	const applicant_types = edits?.applicant_types || proposal.applicant_types || 'both';
	const province_scope = edits?.province_scope || proposal.province_scope || 'ON';
	const amount_notes =
		edits && 'amount_notes' in edits
			? edits.amount_notes ?? null
			: proposal.amount_notes;
	const disciplines = edits?.disciplines || proposal.disciplines || '[]';
	const status = /rolling/i.test(deadline_notes || '') ? 'rolling' : 'open';

	let slug = slugify(title);
	const clash = await db
		.prepare(`SELECT id FROM grants WHERE slug = ?`)
		.bind(slug)
		.first();
	if (clash) slug = `${slug}-${proposal.id.slice(0, 8)}`;

	const grantId = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO grants (
        id, slug, name, funder, applicant_types, eligibility_summary,
        amount_min, amount_max, amount_notes, deadline_at, deadline_notes,
        url, province_scope, disciplines, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			grantId,
			slug,
			title,
			funder,
			applicant_types,
			eligibility,
			amountMin,
			amountMax,
			amount_notes,
			deadline_at,
			deadline_notes,
			url,
			province_scope,
			disciplines,
			status,
		)
		.run();

	await db
		.prepare(
			`UPDATE grant_proposals SET status = 'approved', published_grant_id = ?, reviewed_at = datetime('now'),
        title = ?, funder = ?, url = ?, deadline_at = ?, deadline_notes = ?, raw_excerpt = ?,
        applicant_types = ?, province_scope = ?, amount_notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
		)
		.bind(
			grantId,
			title,
			funder,
			url,
			deadline_at,
			deadline_notes,
			eligibility,
			applicant_types,
			province_scope,
			amount_notes,
			proposalId,
		)
		.run();

	return { ok: true, grantId };
}

export async function rejectProposal(
	db: D1Database,
	proposalId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const result = await db
		.prepare(
			`UPDATE grant_proposals SET status = 'rejected', reviewed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND status = 'pending'`,
		)
		.bind(proposalId)
		.run();
	if (!result.meta.changes) return { ok: false, error: 'Proposal not pending' };
	return { ok: true };
}
