import { describe, expect, it } from 'vitest';
import { parseExtractJson } from '@/lib/discovery/extract/schema';

describe('parseExtractJson', () => {
	it('parses fenced JSON and keeps ISO deadlines', () => {
		const raw = `\`\`\`json
{
  "title": "Project Grant",
  "funder": "OAC",
  "deadlines": [{"date":"2026-04-15","label":"final"},{"date":"bogus"}],
  "deadline_notes": "Rolling for some streams",
  "eligibility_summary": "Ontario artists",
  "amount_min": 1000,
  "amount_max": 5000,
  "amount_notes": null,
  "applicant_types": "individual",
  "disciplines": ["music","theatre","extra","a","b","c","d","e","f","g","h","i","j"],
  "province_scope": "ON",
  "confidence": 0.9,
  "quotes": ["q1","q2","q3","q4","q5","q6"],
  "notes": null
}
\`\`\``;
		const ex = parseExtractJson(raw);
		expect(ex.title).toBe('Project Grant');
		expect(ex.deadlines).toEqual([{ date: '2026-04-15', label: 'final' }]);
		expect(ex.deadline_notes).toMatch(/Rolling/);
		expect(ex.deadline_notes).toMatch(/Dropped non-ISO/);
		expect(ex.applicant_types).toBe('individual');
		expect(ex.disciplines).toHaveLength(12);
		expect(ex.quotes).toHaveLength(5);
		expect(ex.confidence).toBeLessThanOrEqual(0.55);
	});

	it('accepts legacy deadline_at ISO and clears invalid', () => {
		const ok = parseExtractJson(
			JSON.stringify({
				title: 'A',
				deadline_at: '2026-09-01',
				confidence: 0.8,
			}),
		);
		expect(ok.deadlines).toEqual([{ date: '2026-09-01', label: null }]);

		const bad = parseExtractJson(
			JSON.stringify({
				title: 'B',
				deadline_at: 'early 2026',
				confidence: 0.9,
			}),
		);
		expect(bad.deadlines).toEqual([]);
		expect(bad.deadline_notes).toMatch(/Invalid legacy/);
		expect(bad.confidence).toBeLessThanOrEqual(0.4);
	});

	it('throws when no JSON object present', () => {
		expect(() => parseExtractJson('nope')).toThrow(/No JSON object/);
	});

	it('coerces invalid enums to null and clamps confidence', () => {
		const ex = parseExtractJson(
			JSON.stringify({
				applicant_types: 'team',
				province_scope: 'QC',
				confidence: 2,
				deadlines: [{ date: '2026-04-01' }],
			}),
		);
		expect(ex.applicant_types).toBeNull();
		expect(ex.province_scope).toBeNull();
		// raw 2 → clamped to 1 (valid deadlines keep full confidence)
		expect(ex.confidence).toBe(1);
		expect(ex.deadlines).toEqual([{ date: '2026-04-01', label: null }]);
	});
});
