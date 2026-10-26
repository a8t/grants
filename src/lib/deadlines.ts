/**
 * Structured grant deadlines — ISO calendar dates only.
 * "Today" for open/closed is America/Toronto (Ontario product).
 */

export type GrantDeadline = {
	date: string; // YYYY-MM-DD
	label?: string | null;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar date in America/Toronto (YYYY-MM-DD). */
export function todayToronto(now: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Toronto',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now);
}

/** True calendar ISO date (rejects 2026-13-40 etc.). */
export function isValidIsoDate(value: string): boolean {
	const m = value.trim().match(ISO_DATE);
	if (!m) return false;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const d = Number(m[3]);
	if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
	const dt = new Date(Date.UTC(y, mo - 1, d));
	return (
		dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
	);
}

export function normalizeDeadlineLabel(label: unknown): string | null {
	if (typeof label !== 'string') return null;
	const t = label.trim().slice(0, 40);
	return t || null;
}

/** Parse/normalize deadlines; drop invalid; never invent dates. */
export function normalizeDeadlines(input: unknown): GrantDeadline[] {
	if (!Array.isArray(input)) return [];
	const out: GrantDeadline[] = [];
	const seen = new Set<string>();
	for (const item of input) {
		if (!item || typeof item !== 'object') continue;
		const raw = (item as { date?: unknown }).date;
		const date = typeof raw === 'string' ? raw.trim() : '';
		if (!isValidIsoDate(date)) continue;
		const key = date;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			date,
			label: normalizeDeadlineLabel((item as { label?: unknown }).label),
		});
		if (out.length >= 8) break;
	}
	out.sort((a, b) => a.date.localeCompare(b.date));
	return out;
}

export function parseDeadlinesJson(raw: string | null | undefined): GrantDeadline[] {
	if (!raw?.trim()) return [];
	try {
		return normalizeDeadlines(JSON.parse(raw));
	} catch {
		return [];
	}
}

export function serializeDeadlines(deadlines: GrantDeadline[]): string {
	return JSON.stringify(normalizeDeadlines(deadlines));
}

/** Build from legacy single deadline_at (+ optional second date in notes). */
export function deadlinesFromLegacy(
	deadlineAt: string | null | undefined,
	deadlineNotes?: string | null,
): GrantDeadline[] {
	const list: GrantDeadline[] = [];
	if (deadlineAt && isValidIsoDate(deadlineAt)) {
		list.push({ date: deadlineAt, label: null });
	}
	if (deadlineNotes) {
		const m = deadlineNotes.match(
			/(?:second|final|loi|intake)\s*(?:deadline)?[:\s]+(?:([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})|(\d{4}-\d{2}-\d{2}))/i,
		);
		if (m) {
			let iso: string | null = m[4] ?? null;
			if (!iso && m[1] && m[2] && m[3]) {
				iso = englishDateToIso(m[1], m[2], m[3]);
			}
			if (iso && isValidIsoDate(iso) && !list.some((d) => d.date === iso)) {
				const labelMatch = deadlineNotes.match(/\b(second|final|loi|intake\s*\d+)\b/i);
				list.push({
					date: iso,
					label: labelMatch ? labelMatch[1].toLowerCase() : 'intake',
				});
			}
		}
		// Plain second ISO in notes
		const isos = deadlineNotes.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
		for (const iso of isos) {
			if (isValidIsoDate(iso) && !list.some((d) => d.date === iso)) {
				list.push({ date: iso, label: null });
			}
		}
	}
	return normalizeDeadlines(list);
}

const MONTHS: Record<string, string> = {
	january: '01',
	february: '02',
	march: '03',
	april: '04',
	may: '05',
	june: '06',
	july: '07',
	august: '08',
	september: '09',
	october: '10',
	november: '11',
	december: '12',
	jan: '01',
	feb: '02',
	mar: '03',
	apr: '04',
	jun: '06',
	jul: '07',
	aug: '08',
	sep: '09',
	oct: '10',
	nov: '11',
	dec: '12',
};

export function englishDateToIso(
	month: string,
	day: string,
	year: string,
): string | null {
	const mm = MONTHS[month.toLowerCase()];
	if (!mm) return null;
	const iso = `${year}-${mm}-${day.padStart(2, '0')}`;
	return isValidIsoDate(iso) ? iso : null;
}

/** Earliest deadline on/after todayToronto; null if none. */
export function nextDeadlineDate(
	deadlines: GrantDeadline[],
	today: string = todayToronto(),
): string | null {
	const upcoming = deadlines.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
	return upcoming[0]?.date ?? null;
}

export function latestDeadlineDate(deadlines: GrantDeadline[]): string | null {
	if (!deadlines.length) return null;
	return [...deadlines].sort((a, b) => b.date.localeCompare(a.date))[0].date;
}

/**
 * Open = rolling status, OR at least one ISO deadline >= today (Toronto).
 * Null / notes-only / past-only → not open.
 */
export function isGrantOpen(opts: {
	deadlines: GrantDeadline[];
	status?: string | null;
	today?: string;
}): boolean {
	const today = opts.today ?? todayToronto();
	if (opts.status === 'rolling') return true;
	return opts.deadlines.some((d) => d.date >= today);
}

export function isGrantClosed(opts: {
	deadlines: GrantDeadline[];
	status?: string | null;
	today?: string;
}): boolean {
	if (opts.status === 'rolling') return false;
	const today = opts.today ?? todayToronto();
	if (!opts.deadlines.length) return true; // no real dates → not open
	return opts.deadlines.every((d) => d.date < today);
}

export function formatIsoDateEnCa(iso: string): string {
	if (!isValidIsoDate(iso)) return iso;
	const d = new Date(`${iso}T12:00:00Z`);
	return new Intl.DateTimeFormat('en-CA', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC',
	}).format(d);
}

export function deadlinesFromForm(form: FormData, max = 6): GrantDeadline[] {
	const out: GrantDeadline[] = [];
	for (let i = 0; i < max; i++) {
		const date = String(form.get(`deadline_date_${i}`) ?? '').trim();
		const label = String(form.get(`deadline_label_${i}`) ?? '').trim() || null;
		if (!date) continue;
		if (!isValidIsoDate(date)) continue;
		out.push({ date, label });
	}
	return normalizeDeadlines(out);
}
