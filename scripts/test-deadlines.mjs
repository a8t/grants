/**
 * Quick smoke for structured deadlines + America/Toronto open/closed filter.
 * Run: node scripts/test-deadlines.mjs
 */
import assert from 'node:assert/strict';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidIsoDate(value) {
	const m = value.trim().match(ISO);
	if (!m) return false;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const d = Number(m[3]);
	const dt = new Date(Date.UTC(y, mo - 1, d));
	return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function normalizeDeadlines(input) {
	if (!Array.isArray(input)) return [];
	const out = [];
	const seen = new Set();
	for (const item of input) {
		if (!item || typeof item !== 'object') continue;
		const date = typeof item.date === 'string' ? item.date.trim() : '';
		if (!isValidIsoDate(date) || seen.has(date)) continue;
		seen.add(date);
		out.push({
			date,
			label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : null,
		});
	}
	return out.sort((a, b) => a.date.localeCompare(b.date));
}

function isGrantOpen({ deadlines, status, today }) {
	if (status === 'rolling') return true;
	return deadlines.some((d) => d.date >= today);
}

function isGrantClosed({ deadlines, status, today }) {
	if (status === 'rolling') return false;
	if (!deadlines.length) return false; // unknown — not closed
	return deadlines.every((d) => d.date < today);
}

function isDeadlinePast(date, today) {
	return isValidIsoDate(date) && date < today;
}

const today = '2026-10-26';

assert.deepEqual(
	normalizeDeadlines([{ date: 'rolling' }, { date: 'early 2026' }, { date: '2026-13-40' }]),
	[],
);

const multiPast = normalizeDeadlines([
	{ date: '2026-04-23', label: 'intake 1' },
	{ date: '2026-09-10', label: 'intake 2' },
]);
assert.equal(isGrantOpen({ deadlines: multiPast, status: 'open', today }), false);
assert.equal(isGrantClosed({ deadlines: multiPast, status: 'open', today }), true);

const multiMixed = normalizeDeadlines([
	{ date: '2026-04-23', label: 'intake 1' },
	{ date: '2026-11-15', label: 'intake 2' },
]);
assert.equal(isGrantOpen({ deadlines: multiMixed, status: 'open', today }), true);
assert.equal(isGrantClosed({ deadlines: multiMixed, status: 'open', today }), false);
assert.equal(isDeadlinePast('2026-04-23', today), true);
assert.equal(isDeadlinePast('2026-11-15', today), false);
assert.equal(isDeadlinePast('2026-10-26', today), false); // today = upcoming emphasis

// Null / notes-only → neither open nor closed
assert.equal(isGrantOpen({ deadlines: [], status: 'open', today }), false);
assert.equal(isGrantClosed({ deadlines: [], status: 'open', today }), false);

assert.equal(isGrantOpen({ deadlines: [], status: 'rolling', today }), true);
assert.equal(isGrantClosed({ deadlines: [], status: 'rolling', today }), false);

assert.equal(
	isGrantOpen({ deadlines: [{ date: '2026-10-26', label: null }], status: 'open', today }),
	true,
);
assert.equal(
	isGrantClosed({ deadlines: [{ date: '2026-10-25', label: null }], status: 'open', today }),
	true,
);

console.log('ok — deadlines open/closed + past-chip rules (today fixture', today + ')');
