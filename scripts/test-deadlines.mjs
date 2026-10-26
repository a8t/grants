/**
 * Quick smoke for structured deadlines + America/Toronto open filter.
 * Run: node scripts/test-deadlines.mjs
 */
import assert from 'node:assert/strict';

// Inline mirrors of core logic (keep in sync with src/lib/deadlines.ts) for zero-build smoke.
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
		out.push({ date, label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : null });
	}
	return out.sort((a, b) => a.date.localeCompare(b.date));
}

function isGrantOpen({ deadlines, status, today }) {
	if (status === 'rolling') return true;
	return deadlines.some((d) => d.date >= today);
}

function isGrantClosed({ deadlines, status, today }) {
	if (status === 'rolling') return false;
	if (!deadlines.length) return true;
	return deadlines.every((d) => d.date < today);
}

const today = '2026-10-26'; // fixed America/Toronto-style fixture

// Reject prose / invalid
assert.deepEqual(normalizeDeadlines([{ date: 'rolling' }, { date: 'early 2026' }, { date: '2026-13-40' }]), []);
assert.deepEqual(
	normalizeDeadlines([{ date: '2026-09-10', label: 'intake 2' }, { date: '2026-04-23', label: 'intake 1' }]),
	[
		{ date: '2026-04-23', label: 'intake 1' },
		{ date: '2026-09-10', label: 'intake 2' },
	],
);

// Multi-deadline: still open if any date >= today
const multi = normalizeDeadlines([
	{ date: '2026-04-23', label: 'intake 1' },
	{ date: '2026-09-10', label: 'intake 2' },
]);
// Sep 10 2026 is before Oct 26 2026 → both past → closed
assert.equal(isGrantOpen({ deadlines: multi, status: 'open', today }), false);
assert.equal(isGrantClosed({ deadlines: multi, status: 'open', today }), true);

const multiFuture = normalizeDeadlines([
	{ date: '2026-04-23', label: 'intake 1' },
	{ date: '2026-11-15', label: 'intake 2' },
]);
assert.equal(isGrantOpen({ deadlines: multiFuture, status: 'open', today }), true);

// Null / notes-only not open
assert.equal(isGrantOpen({ deadlines: [], status: 'open', today }), false);
assert.equal(isGrantClosed({ deadlines: [], status: 'open', today }), true);

// Rolling open
assert.equal(isGrantOpen({ deadlines: [], status: 'rolling', today }), true);

// Single upcoming
assert.equal(
	isGrantOpen({ deadlines: [{ date: '2026-10-26', label: null }], status: 'open', today }),
	true,
);
assert.equal(
	isGrantOpen({ deadlines: [{ date: '2026-10-25', label: null }], status: 'open', today }),
	false,
);

console.log('ok — deadlines + open filter smoke passed (today fixture', today + ')');
