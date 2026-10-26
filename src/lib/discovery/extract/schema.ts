/**
 * Strict JSON shape returned by GrantPageExtractor.
 * Deadlines are ISO dates only — never invent; use [] + notes for rolling/TBD.
 */
import {
	normalizeDeadlines,
	type GrantDeadline,
	isValidIsoDate,
} from '@/lib/deadlines';

export type { GrantDeadline };

export type GrantExtract = {
	title: string | null;
	funder: string | null;
	/** Structured calendar deadlines only (YYYY-MM-DD). */
	deadlines: GrantDeadline[];
	/** Rolling / TBD / free-text — not a calendar date. */
	deadline_notes: string | null;
	eligibility_summary: string | null;
	amount_min: number | null;
	amount_max: number | null;
	amount_notes: string | null;
	applicant_types: 'individual' | 'organization' | 'both' | null;
	disciplines: string[];
	province_scope: 'ON' | 'CA' | 'other' | null;
	confidence: number;
	quotes: string[];
	notes: string | null;
};

export const EXTRACT_JSON_SCHEMA_HINT = `{
  "title": string|null,
  "funder": string|null,
  "deadlines": [{"date":"YYYY-MM-DD","label":"intake 1"|"LOI"|"final"|string|null}],
  "deadline_notes": string|null,
  "eligibility_summary": string|null,
  "amount_min": number|null,
  "amount_max": number|null,
  "amount_notes": string|null,
  "applicant_types": "individual"|"organization"|"both"|null,
  "disciplines": string[],
  "province_scope": "ON"|"CA"|"other"|null,
  "confidence": number,
  "quotes": string[],
  "notes": string|null
}`;

export function emptyExtract(partial?: Partial<GrantExtract>): GrantExtract {
	return {
		title: null,
		funder: null,
		deadlines: [],
		deadline_notes: null,
		eligibility_summary: null,
		amount_min: null,
		amount_max: null,
		amount_notes: null,
		applicant_types: null,
		disciplines: [],
		province_scope: null,
		confidence: 0,
		quotes: [],
		notes: null,
		...partial,
	};
}

function coerceDeadlinesField(obj: Record<string, unknown>): {
	deadlines: GrantDeadline[];
	notesExtra: string | null;
	capped: boolean;
} {
	let notesExtra: string | null = null;
	let capped = false;

	// Preferred: deadlines array
	if (Array.isArray(obj.deadlines)) {
		const normalized = normalizeDeadlines(obj.deadlines);
		const rawLen = obj.deadlines.length;
		if (rawLen > 0 && normalized.length === 0) {
			capped = true;
			notesExtra = 'All model deadline entries invalid; cleared';
		} else if (normalized.length < rawLen) {
			capped = true;
			notesExtra = 'Dropped non-ISO deadline entries';
		}
		return { deadlines: normalized, notesExtra, capped };
	}

	// Legacy single deadline_at (older prompts / cached responses)
	const legacy = obj.deadline_at;
	if (typeof legacy === 'string' && legacy.trim()) {
		const t = legacy.trim();
		if (isValidIsoDate(t)) {
			return { deadlines: [{ date: t, label: null }], notesExtra: null, capped: false };
		}
		capped = true;
		notesExtra = `Invalid legacy deadline_at "${t}" cleared`;
		return { deadlines: [], notesExtra, capped };
	}

	return { deadlines: [], notesExtra: null, capped: false };
}

export function parseExtractJson(raw: string): GrantExtract {
	const cleaned = raw
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/i, '');
	const start = cleaned.indexOf('{');
	const end = cleaned.lastIndexOf('}');
	if (start < 0 || end <= start) {
		throw new Error('No JSON object in model response');
	}
	const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

	const applicant = obj.applicant_types;
	const applicantTypes =
		applicant === 'individual' || applicant === 'organization' || applicant === 'both'
			? applicant
			: null;

	const scope = obj.province_scope;
	const provinceScope = scope === 'ON' || scope === 'CA' || scope === 'other' ? scope : null;

	const num = (v: unknown): number | null =>
		typeof v === 'number' && Number.isFinite(v) ? v : null;
	const str = (v: unknown): string | null =>
		typeof v === 'string' && v.trim() ? v.trim() : null;

	let confidence = num(obj.confidence) ?? 0;
	confidence = Math.max(0, Math.min(1, confidence));

	const { deadlines, notesExtra, capped } = coerceDeadlinesField(obj);
	if (capped || deadlines.length === 0) {
		confidence = Math.min(confidence, deadlines.length === 0 ? 0.4 : 0.55);
	}

	const deadlineNotes = [str(obj.deadline_notes), notesExtra].filter(Boolean).join(' · ') || null;

	return emptyExtract({
		title: str(obj.title),
		funder: str(obj.funder),
		deadlines,
		deadline_notes: deadlineNotes,
		eligibility_summary: str(obj.eligibility_summary),
		amount_min: num(obj.amount_min),
		amount_max: num(obj.amount_max),
		amount_notes: str(obj.amount_notes),
		applicant_types: applicantTypes,
		disciplines: Array.isArray(obj.disciplines)
			? obj.disciplines.map(String).slice(0, 12)
			: [],
		province_scope: provinceScope,
		confidence,
		quotes: Array.isArray(obj.quotes) ? obj.quotes.map(String).slice(0, 5) : [],
		notes: str(obj.notes),
	});
}
