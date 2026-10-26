import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { getDrizzle, grantProposals } from '@/lib/db';
import { createGrantPageExtractor, type EnrichResult } from './extract';
import { sleep } from './robots';

export type ProposalEnrichRow = {
	id: string;
	url: string;
	status: string;
	llm_enriched_at: string | null;
};

export async function enrichProposal(
	db: D1Database,
	env: Env,
	proposalId: string,
): Promise<EnrichResult & { proposalId: string }> {
	const drizzle = getDrizzle(db);
	const row = await drizzle
		.select({
			id: grantProposals.id,
			url: grantProposals.url,
			status: grantProposals.status,
			llm_enriched_at: grantProposals.llmEnrichedAt,
		})
		.from(grantProposals)
		.where(eq(grantProposals.id, proposalId))
		.limit(1)
		.then((r) => r[0]);

	if (!row) {
		return { ok: false, error: 'Proposal not found', proposalId };
	}

	const extractor = createGrantPageExtractor(env);
	const result = await extractor.enrich(row.url);

	if (!result.ok) {
		await drizzle
			.update(grantProposals)
			.set({
				llmError: result.error,
				llmEnrichedAt: sql`(datetime('now'))`,
				updatedAt: sql`(datetime('now'))`,
			})
			.where(eq(grantProposals.id, proposalId));
		return { ...result, proposalId };
	}

	await drizzle
		.update(grantProposals)
		.set({
			llmExtractJson: JSON.stringify(result.extract),
			llmRawResponse: result.raw.slice(0, 50_000),
			llmProvider: result.provider,
			llmModel: result.model,
			llmEnrichedAt: sql`(datetime('now'))`,
			llmError: null,
			updatedAt: sql`(datetime('now'))`,
		})
		.where(eq(grantProposals.id, proposalId));

	return { ...result, proposalId };
}

/** Enrich up to `limit` pending proposals that lack a successful extract. */
export async function enrichPendingBatch(
	db: D1Database,
	env: Env,
	opts?: { limit?: number; delayMs?: number },
): Promise<{ attempted: number; ok: number; failed: number; errors: string[] }> {
	const limit = opts?.limit ?? 5;
	const delayMs = opts?.delayMs ?? 1500;
	const drizzle = getDrizzle(db);
	const list = await drizzle
		.select({
			id: grantProposals.id,
			url: grantProposals.url,
			status: grantProposals.status,
			llm_enriched_at: grantProposals.llmEnrichedAt,
		})
		.from(grantProposals)
		.where(
			and(
				eq(grantProposals.status, 'pending'),
				or(isNull(grantProposals.llmExtractJson), isNotNull(grantProposals.llmError)),
			),
		)
		.orderBy(desc(grantProposals.discoveredAt))
		.limit(limit);

	let ok = 0;
	let failed = 0;
	const errors: string[] = [];
	for (let i = 0; i < list.length; i++) {
		if (i > 0) await sleep(delayMs);
		const r = await enrichProposal(db, env, list[i].id);
		if (r.ok) ok += 1;
		else {
			failed += 1;
			errors.push(`${list[i].id}: ${r.error}`);
		}
	}
	return { attempted: list.length, ok, failed, errors };
}
