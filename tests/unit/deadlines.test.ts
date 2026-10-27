import { describe, expect, it } from 'vitest';
import {
	deadlinesFromLegacy,
	englishDateToIso,
	isGrantClosed,
	isGrantDeadlineUnknown,
	isGrantOpen,
	isValidIsoDate,
	nextDeadlineDate,
	normalizeDeadlines,
	parseDeadlinesJson,
	serializeDeadlines,
	todayToronto,
} from '@/lib/deadlines';

describe('isValidIsoDate', () => {
	it('accepts real calendar dates', () => {
		expect(isValidIsoDate('2026-04-15')).toBe(true);
		expect(isValidIsoDate('2024-02-29')).toBe(true);
	});

	it('rejects garbage and impossible dates', () => {
		expect(isValidIsoDate('2026-13-40')).toBe(false);
		expect(isValidIsoDate('2025-02-29')).toBe(false);
		expect(isValidIsoDate('April 15, 2026')).toBe(false);
		expect(isValidIsoDate('')).toBe(false);
	});
});

describe('normalizeDeadlines / parse / serialize', () => {
	it('dedupes, sorts, drops invalid, caps at 8', () => {
		const out = normalizeDeadlines([
			{ date: '2026-06-01', label: ' final ' },
			{ date: '2026-06-01', label: 'dup' },
			{ date: 'not-a-date', label: 'x' },
			{ date: '2026-01-15', label: null },
			{ date: '2026-03-01' },
			{ date: '2026-04-01' },
			{ date: '2026-05-01' },
			{ date: '2026-07-01' },
			{ date: '2026-08-01' },
			{ date: '2026-09-01' },
			{ date: '2026-10-01' },
		]);
		expect(out.map((d) => d.date)).toEqual([
			'2026-01-15',
			'2026-03-01',
			'2026-04-01',
			'2026-05-01',
			'2026-06-01',
			'2026-07-01',
			'2026-08-01',
			'2026-09-01',
		]);
		expect(out.find((d) => d.date === '2026-06-01')?.label).toBe('final');
	});

	it('round-trips JSON and tolerates bad JSON', () => {
		const json = serializeDeadlines([{ date: '2026-04-15', label: 'LOI' }]);
		expect(parseDeadlinesJson(json)).toEqual([{ date: '2026-04-15', label: 'LOI' }]);
		expect(parseDeadlinesJson('not-json')).toEqual([]);
		expect(parseDeadlinesJson(null)).toEqual([]);
	});
});

describe('open / closed (America/Toronto calendar day)', () => {
	const today = '2026-06-15';

	it('rolling is always open, never closed', () => {
		expect(isGrantOpen({ deadlines: [], status: 'rolling', today })).toBe(true);
		expect(isGrantClosed({ deadlines: [{ date: '2020-01-01' }], status: 'rolling', today })).toBe(
			false,
		);
	});

	it('open when any deadline is on/after today', () => {
		expect(
			isGrantOpen({
				deadlines: [
					{ date: '2026-01-01' },
					{ date: '2026-07-01' },
				],
				today,
			}),
		).toBe(true);
		expect(isGrantClosed({ deadlines: [{ date: '2026-07-01' }], today })).toBe(false);
	});

	it('closed only when all ISO dates are past', () => {
		expect(
			isGrantClosed({
				deadlines: [{ date: '2026-01-01' }, { date: '2026-06-14' }],
				today,
			}),
		).toBe(true);
		expect(isGrantOpen({ deadlines: [{ date: '2026-01-01' }], today })).toBe(false);
	});

	it('notes-only / empty deadlines are unknown (neither open nor closed)', () => {
		expect(isGrantOpen({ deadlines: [], today })).toBe(false);
		expect(isGrantClosed({ deadlines: [], today })).toBe(false);
		expect(isGrantDeadlineUnknown({ deadlines: [], status: 'open' })).toBe(true);
	});

	it('nextDeadlineDate picks earliest upcoming', () => {
		expect(
			nextDeadlineDate(
				[{ date: '2026-01-01' }, { date: '2026-06-15' }, { date: '2026-08-01' }],
				today,
			),
		).toBe('2026-06-15');
		expect(nextDeadlineDate([{ date: '2026-01-01' }], today)).toBeNull();
	});
});

describe('todayToronto / englishDateToIso / legacy', () => {
	it('formats America/Toronto calendar date', () => {
		// 2026-01-01 05:00 UTC is still 2025-12-31 in Toronto (EST)
		const eve = new Date('2026-01-01T04:30:00Z');
		expect(todayToronto(eve)).toBe('2025-12-31');
		const afternoon = new Date('2026-01-01T18:00:00Z');
		expect(todayToronto(afternoon)).toBe('2026-01-01');
	});

	it('parses English month dates', () => {
		expect(englishDateToIso('April', '5', '2026')).toBe('2026-04-05');
		expect(englishDateToIso('Feb', '30', '2026')).toBeNull();
	});

	it('builds from legacy deadline_at + notes', () => {
		const d = deadlinesFromLegacy('2026-03-01', 'Second deadline: May 15, 2026');
		expect(d.map((x) => x.date)).toEqual(['2026-03-01', '2026-05-15']);
	});
});
