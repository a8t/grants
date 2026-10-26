import { and, eq, sql } from 'drizzle-orm';
import {
	deadlinesFromLegacy,
	nextDeadlineDate,
	normalizeDeadlines,
	serializeDeadlines,
	type GrantDeadline,
} from '@/lib/deadlines';
import { getDrizzle, grantProposals, grantSources, grants } from '@/lib/db';
import { getAdapter } from './adapters';
import type { DiscoveredGrant } from './types';
import { slugify } from './fetch';

function discoveredDeadlines(item: DiscoveredGrant): GrantDeadline[] {
	if (item.deadlines?.length) return normalizeDeadlines(item.deadlines);
	return deadlinesFromLegacy(item.deadlineAt ?? null, item.deadlineNotes ?? null);
}

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
	const drizzle = getDrizzle(db);
	const existing = await drizzle
		.select({ id: grantProposals.id, status: grantProposals.status })
		.from(grantProposals)
		.where(eq(grantProposals.dedupeKey, item.dedupeKey))
		.limit(1)
		.then((r) => r[0]);

	if (existing) {
		if (existing.status === 'rejected' || existing.status === 'approved') {
			return 'skipped';
		}
		const deadlines = discoveredDeadlines(item);
		const deadlineAt = nextDeadlineDate(deadlines) ?? deadlines[0]?.date ?? null;
		await drizzle
			.update(grantProposals)
			.set({
				title: item.title,
				funder: item.funder,
				url: item.url,
				deadlineAt,
				deadlineNotes: item.deadlineNotes ?? null,
				deadlinesJson: serializeDeadlines(deadlines),
				rawExcerpt: item.rawExcerpt ?? null,
				applicantTypes: item.applicantTypes ?? 'both',
				amountNotes: item.amountNotes ?? null,
				provinceScope: item.provinceScope ?? 'ON',
				disciplines: JSON.stringify(item.disciplines ?? []),
				updatedAt: sql`(datetime('now'))`,
			})
			.where(and(eq(grantProposals.id, existing.id), eq(grantProposals.status, 'pending')));
		return 'upserted';
	}

	const id = crypto.randomUUID();
	const deadlines = discoveredDeadlines(item);
	const deadlineAt = nextDeadlineDate(deadlines) ?? deadlines[0]?.date ?? null;
	await drizzle.insert(grantProposals).values({
		id,
		sourceId,
		title: item.title,
		funder: item.funder,
		url: item.url,
		deadlineAt,
		deadlineNotes: item.deadlineNotes ?? null,
		deadlinesJson: serializeDeadlines(deadlines),
		rawExcerpt: item.rawExcerpt ?? null,
		applicantTypes: item.applicantTypes ?? 'both',
		amountNotes: item.amountNotes ?? null,
		provinceScope: item.provinceScope ?? 'ON',
		disciplines: JSON.stringify(item.disciplines ?? []),
		dedupeKey: item.dedupeKey,
		status: 'pending',
	});
	return 'upserted';
}

export async function runSource(
	db: D1Database,
	source: SourceRow,
): Promise<RunSummary> {
	const drizzle = getDrizzle(db);
	const adapter = getAdapter(source.adapter_key);
	if (!adapter) {
		const error = `Unknown adapter: ${source.adapter_key}`;
		await drizzle
			.update(grantSources)
			.set({
				lastRunAt: sql`(datetime('now'))`,
				lastStatus: 'error',
				lastError: error,
				updatedAt: sql`(datetime('now'))`,
			})
			.where(eq(grantSources.id, source.id));
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
			await drizzle
				.update(grantSources)
				.set({
					lastRunAt: sql`(datetime('now'))`,
					lastStatus: 'error',
					lastError: result.error ?? 'adapter failed',
					lastFound: 0,
					updatedAt: sql`(datetime('now'))`,
				})
				.where(eq(grantSources.id, source.id));
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

		await drizzle
			.update(grantSources)
			.set({
				lastRunAt: sql`(datetime('now'))`,
				lastStatus: 'ok',
				lastError: null,
				lastFound: result.items.length,
				updatedAt: sql`(datetime('now'))`,
			})
			.where(eq(grantSources.id, source.id));

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
		await drizzle
			.update(grantSources)
			.set({
				lastRunAt: sql`(datetime('now'))`,
				lastStatus: 'error',
				lastError: error,
				updatedAt: sql`(datetime('now'))`,
			})
			.where(eq(grantSources.id, source.id));
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
	const drizzle = getDrizzle(db);
	const rows = await drizzle
		.select({
			id: grantSources.id,
			name: grantSources.name,
			adapter_key: grantSources.adapterKey,
			enabled: grantSources.enabled,
		})
		.from(grantSources)
		.where(eq(grantSources.enabled, 1))
		.orderBy(grantSources.name);
	const summaries: RunSummary[] = [];
	for (const source of rows) {
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
		deadlines?: GrantDeadline[];
		deadline_notes?: string | null;
		eligibility_summary?: string;
		applicant_types?: string;
		province_scope?: string;
		amount_notes?: string | null;
		disciplines?: string;
	},
): Promise<{ ok: true; grantId: string } | { ok: false; error: string }> {
	const drizzle = getDrizzle(db);
	const proposal = await drizzle
		.select()
		.from(grantProposals)
		.where(eq(grantProposals.id, proposalId))
		.limit(1)
		.then((r) => r[0]);

	if (!proposal) return { ok: false, error: 'Proposal not found' };
	if (proposal.status === 'approved') return { ok: false, error: 'Already approved' };

	let amountMin: number | null = null;
	let amountMax: number | null = null;
	let llmDeadlines: GrantDeadline[] = [];
	if (proposal.llmExtractJson) {
		try {
			const ex = JSON.parse(proposal.llmExtractJson) as {
				amount_min?: number | null;
				amount_max?: number | null;
				deadlines?: GrantDeadline[];
				deadline_at?: string | null;
			};
			amountMin = typeof ex.amount_min === 'number' ? ex.amount_min : null;
			amountMax = typeof ex.amount_max === 'number' ? ex.amount_max : null;
			if (Array.isArray(ex.deadlines)) llmDeadlines = normalizeDeadlines(ex.deadlines);
			else if (ex.deadline_at) llmDeadlines = deadlinesFromLegacy(ex.deadline_at, null);
		} catch {
			/* ignore */
		}
	}

	const title = edits?.title?.trim() || proposal.title;
	const funder = edits?.funder?.trim() || proposal.funder;
	const url = edits?.url?.trim() || proposal.url;

	let deadlines: GrantDeadline[];
	if (edits && 'deadlines' in edits) {
		deadlines = normalizeDeadlines(edits.deadlines ?? []);
	} else if (llmDeadlines.length) {
		deadlines = llmDeadlines;
	} else {
		deadlines = deadlinesFromLegacy(proposal.deadlineAt, proposal.deadlineNotes);
		if (proposal.deadlinesJson) {
			try {
				const parsed = normalizeDeadlines(JSON.parse(proposal.deadlinesJson));
				if (parsed.length) deadlines = parsed;
			} catch {
				/* keep legacy */
			}
		}
	}

	const deadline_notes =
		edits && 'deadline_notes' in edits
			? edits.deadline_notes ?? null
			: proposal.deadlineNotes;
	const deadline_at = nextDeadlineDate(deadlines) ?? deadlines[0]?.date ?? null;
	const deadlines_json = serializeDeadlines(deadlines);

	const eligibility =
		edits?.eligibility_summary?.trim() ||
		proposal.rawExcerpt ||
		'See funder program page for full eligibility.';
	const applicant_types = edits?.applicant_types || proposal.applicantTypes || 'both';
	const province_scope = edits?.province_scope || proposal.provinceScope || 'ON';
	const amount_notes =
		edits && 'amount_notes' in edits
			? edits.amount_notes ?? null
			: proposal.amountNotes;
	const disciplines = edits?.disciplines || proposal.disciplines || '[]';
	const status = /rolling/i.test(deadline_notes || '') ? 'rolling' : 'open';

	let slug = slugify(title);
	const clash = await drizzle
		.select({ id: grants.id })
		.from(grants)
		.where(eq(grants.slug, slug))
		.limit(1)
		.then((r) => r[0]);
	if (clash) slug = `${slug}-${proposal.id.slice(0, 8)}`;

	const grantId = crypto.randomUUID();
	await drizzle.insert(grants).values({
		id: grantId,
		slug,
		name: title,
		funder,
		applicantTypes: applicant_types,
		eligibilitySummary: eligibility,
		amountMin,
		amountMax,
		amountNotes: amount_notes,
		deadlineAt: deadline_at,
		deadlineNotes: deadline_notes,
		deadlinesJson: deadlines_json,
		url,
		provinceScope: province_scope,
		disciplines,
		status,
	});

	await drizzle
		.update(grantProposals)
		.set({
			status: 'approved',
			publishedGrantId: grantId,
			reviewedAt: sql`(datetime('now'))`,
			title,
			funder,
			url,
			deadlineAt: deadline_at,
			deadlineNotes: deadline_notes,
			deadlinesJson: deadlines_json,
			rawExcerpt: eligibility,
			applicantTypes: applicant_types,
			provinceScope: province_scope,
			amountNotes: amount_notes,
			updatedAt: sql`(datetime('now'))`,
		})
		.where(eq(grantProposals.id, proposalId));

	return { ok: true, grantId };
}

export async function rejectProposal(
	db: D1Database,
	proposalId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const drizzle = getDrizzle(db);
	const row = await drizzle
		.select({ id: grantProposals.id, status: grantProposals.status })
		.from(grantProposals)
		.where(eq(grantProposals.id, proposalId))
		.limit(1)
		.then((r) => r[0]);
	if (!row) return { ok: false, error: 'Proposal not found' };
	if (row.status !== 'pending') return { ok: false, error: 'Proposal not pending' };

	await drizzle
		.update(grantProposals)
		.set({
			status: 'rejected',
			reviewedAt: sql`(datetime('now'))`,
			updatedAt: sql`(datetime('now'))`,
		})
		.where(eq(grantProposals.id, proposalId));
	return { ok: true };
}
