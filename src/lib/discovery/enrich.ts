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
	const row = await db
		.prepare(
			`SELECT id, url, status, llm_enriched_at FROM grant_proposals WHERE id = ?`,
		)
		.bind(proposalId)
		.first<ProposalEnrichRow>();

	if (!row) {
		return { ok: false, error: 'Proposal not found', proposalId };
	}

	const extractor = createGrantPageExtractor(env);
	const result = await extractor.enrich(row.url);

	if (!result.ok) {
		await db
			.prepare(
				`UPDATE grant_proposals SET llm_error = ?, llm_enriched_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
			)
			.bind(result.error, proposalId)
			.run();
		return { ...result, proposalId };
	}

	await db
		.prepare(
			`UPDATE grant_proposals SET
        llm_extract_json = ?,
        llm_raw_response = ?,
        llm_provider = ?,
        llm_model = ?,
        llm_enriched_at = datetime('now'),
        llm_error = NULL,
        updated_at = datetime('now')
       WHERE id = ?`,
		)
		.bind(
			JSON.stringify(result.extract),
			result.raw.slice(0, 50_000),
			result.provider,
			result.model,
			proposalId,
		)
		.run();

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
	const rows = await db
		.prepare(
			`SELECT id, url, status, llm_enriched_at FROM grant_proposals
       WHERE status = 'pending'
         AND (llm_extract_json IS NULL OR llm_error IS NOT NULL)
       ORDER BY discovered_at DESC
       LIMIT ?`,
		)
		.bind(limit)
		.all<ProposalEnrichRow>();

	let ok = 0;
	let failed = 0;
	const errors: string[] = [];
	const list = rows.results ?? [];
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
