import { politeFetch } from '../fetch';
import { htmlToExtractText } from './clean';
import { extractWithOpenAi, extractWithWorkersAi, type ExtractProviderResult } from './providers';
import { emptyExtract, type GrantExtract } from './schema';

export type { GrantExtract } from './schema';

export type EnrichResult =
	| {
			ok: true;
			extract: GrantExtract;
			raw: string;
			provider: string;
			model: string;
			pageChars: number;
	  }
	| { ok: false; error: string; stubbed?: boolean };

export interface GrantPageExtractor {
	enrich(pageUrl: string): Promise<EnrichResult>;
}

function pickProvider(env: Env): 'workers-ai' | 'openai' | null {
	const pref = (env.GRANT_EXTRACTOR_PROVIDER || 'auto').toLowerCase();
	if (pref === 'workers-ai') return env.AI ? 'workers-ai' : null;
	if (pref === 'openai') return env.OPENAI_API_KEY ? 'openai' : null;
	// auto
	if (env.AI) return 'workers-ai';
	if (env.OPENAI_API_KEY) return 'openai';
	return null;
}

export function createGrantPageExtractor(env: Env): GrantPageExtractor {
	return {
		async enrich(pageUrl: string): Promise<EnrichResult> {
			const provider = pickProvider(env);
			if (!provider) {
				return {
					ok: false,
					error:
						'No LLM provider configured. Add Workers AI binding (AI) or set OPENAI_API_KEY.',
					stubbed: true,
				};
			}

			const fetched = await politeFetch(pageUrl);
			if (!fetched.ok) {
				return { ok: false, error: fetched.error };
			}

			const { text, tooThin } = htmlToExtractText(fetched.html);
			if (tooThin) {
				return {
					ok: false,
					error: `Page text too thin (${text.length} chars) for reliable extract`,
				};
			}

			try {
				let result: ExtractProviderResult;
				if (provider === 'workers-ai') {
					if (!env.AI) return { ok: false, error: 'AI binding missing' };
					result = await extractWithWorkersAi(env.AI, pageUrl, text);
				} else {
					result = await extractWithOpenAi(env.OPENAI_API_KEY!, pageUrl, text);
				}

				// Guard: never invent deadlines — already enforced in schema parse
				if (!result.extract.deadline_at && result.extract.confidence > 0.7) {
					result.extract.confidence = Math.min(result.extract.confidence, 0.55);
					result.extract.notes = [
						result.extract.notes,
						'No clear deadline_at; confidence capped',
					]
						.filter(Boolean)
						.join(' · ');
				}

				return {
					ok: true,
					extract: result.extract,
					raw: result.raw,
					provider: result.provider,
					model: result.model,
					pageChars: text.length,
				};
			} catch (e) {
				return {
					ok: false,
					error: e instanceof Error ? e.message : 'LLM extract failed',
				};
			}
		},
	};
}

/** Apply extract onto proposal fields for admin preview (does not auto-publish). */
export function mergeExtractIntoProposalFields(
	current: {
		title: string;
		funder: string;
		deadline_at: string | null;
		deadline_notes: string | null;
		raw_excerpt: string | null;
		applicant_types: string;
		amount_notes: string | null;
		province_scope: string;
		disciplines: string;
	},
	extract: GrantExtract,
	opts?: { preferLlm?: boolean },
) {
	const prefer = opts?.preferLlm !== false && (extract.confidence ?? 0) >= 0.45;
	return {
		title: prefer && extract.title ? extract.title : current.title,
		funder: prefer && extract.funder ? extract.funder : current.funder,
		deadline_at:
			prefer && extract.deadline_at != null ? extract.deadline_at : current.deadline_at,
		deadline_notes:
			prefer && extract.deadline_notes
				? extract.deadline_notes
				: current.deadline_notes,
		raw_excerpt:
			prefer && extract.eligibility_summary
				? extract.eligibility_summary
				: current.raw_excerpt,
		applicant_types:
			prefer && extract.applicant_types
				? extract.applicant_types
				: current.applicant_types,
		amount_notes:
			prefer && (extract.amount_notes || extract.amount_min != null)
				? extract.amount_notes ||
					[
						extract.amount_min != null ? `min ${extract.amount_min}` : null,
						extract.amount_max != null ? `max ${extract.amount_max}` : null,
					]
						.filter(Boolean)
						.join(' – ')
				: current.amount_notes,
		province_scope:
			prefer && extract.province_scope && extract.province_scope !== 'other'
				? extract.province_scope
				: current.province_scope,
		disciplines:
			prefer && extract.disciplines.length
				? JSON.stringify(extract.disciplines)
				: current.disciplines,
	};
}

export { emptyExtract };
