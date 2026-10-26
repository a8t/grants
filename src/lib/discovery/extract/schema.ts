/**
 * Strict JSON shape returned by GrantPageExtractor.
 * Models must not invent deadlines — use null + low confidence when unclear.
 */
export type GrantExtract = {
	title: string | null;
	funder: string | null;
	deadline_at: string | null;
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
  "deadline_at": "YYYY-MM-DD"|null,
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
		deadline_at: null,
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

	const deadlineAt = str(obj.deadline_at);
	if (deadlineAt && !/^\d{4}-\d{2}-\d{2}$/.test(deadlineAt)) {
		// Invalid date format → treat as unknown (do not invent)
		return emptyExtract({
			title: str(obj.title),
			funder: str(obj.funder),
			deadline_at: null,
			deadline_notes: str(obj.deadline_notes) ?? deadlineAt,
			eligibility_summary: str(obj.eligibility_summary),
			amount_min: num(obj.amount_min),
			amount_max: num(obj.amount_max),
			amount_notes: str(obj.amount_notes),
			applicant_types: applicantTypes,
			disciplines: Array.isArray(obj.disciplines)
				? obj.disciplines.map(String).slice(0, 12)
				: [],
			province_scope: provinceScope,
			confidence: Math.min(confidence, 0.4),
			quotes: Array.isArray(obj.quotes) ? obj.quotes.map(String).slice(0, 5) : [],
			notes: str(obj.notes) ?? 'Invalid deadline_at format; cleared to null',
		});
	}

	return emptyExtract({
		title: str(obj.title),
		funder: str(obj.funder),
		deadline_at: deadlineAt,
		deadline_notes: str(obj.deadline_notes),
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
