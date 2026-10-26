import {
	deadlinesFromLegacy,
	formatIsoDateEnCa,
	isGrantClosed,
	isGrantOpen,
	nextDeadlineDate,
	parseDeadlinesJson,
	todayToronto,
	type GrantDeadline,
} from './deadlines';
import type { Grant, GrantListFilters } from './types';

const PROVINCE_ALIASES: Record<string, string[]> = {
	ON: ['ON', 'CA'],
	CA: ['CA'],
};

/** Resolve structured deadlines for a grant row (JSON or legacy deadline_at). */
export function grantDeadlines(grant: Grant): GrantDeadline[] {
	const fromJson = parseDeadlinesJson(grant.deadlines_json ?? null);
	if (fromJson.length) return fromJson;
	return deadlinesFromLegacy(grant.deadline_at, grant.deadline_notes);
}

export async function listGrants(
	db: D1Database,
	filters: GrantListFilters = {},
): Promise<Grant[]> {
	const clauses: string[] = [];
	const binds: Array<string> = [];

	const province = filters.province ?? 'ON';
	const scopes = PROVINCE_ALIASES[province] ?? [province];
	clauses.push(`province_scope IN (${scopes.map(() => '?').join(', ')})`);
	binds.push(...scopes);

	if (filters.q?.trim()) {
		clauses.push('(name LIKE ? OR funder LIKE ? OR eligibility_summary LIKE ? OR disciplines LIKE ?)');
		const like = `%${filters.q.trim()}%`;
		binds.push(like, like, like, like);
	}

	if (filters.applicant && filters.applicant !== 'all') {
		clauses.push("(applicant_types = ? OR applicant_types = 'both')");
		binds.push(filters.applicant);
	}

	// Open/closed is computed in JS vs America/Toronto "today" + deadlines_json
	// (SQL deadline_at alone misses multi-deadline rows whose next date ≠ deadline_at).
	const today = todayToronto();
	const statusFilter = filters.status;

	if (statusFilter === 'rolling') {
		clauses.push("status = 'rolling'");
	}

	const sql = `
    SELECT * FROM grants
    WHERE ${clauses.join(' AND ')}
    ORDER BY
      CASE WHEN deadline_at IS NULL THEN 1 ELSE 0 END,
      deadline_at ASC,
      name ASC
  `;

	const result = await db.prepare(sql).bind(...binds).all<Grant>();
	const rows = result.results ?? [];

	return rows
		.filter((g) => {
			const deadlines = grantDeadlines(g);
			if (statusFilter === 'rolling') return g.status === 'rolling';
			if (statusFilter === 'closed') {
				return isGrantClosed({ deadlines, status: g.status, today });
			}
			if (statusFilter === 'open') {
				return isGrantOpen({ deadlines, status: g.status, today });
			}
			// Default browse = currently open (incl. rolling)
			return isGrantOpen({ deadlines, status: g.status, today });
		})
		.sort((a, b) => {
			const na = nextDeadlineDate(grantDeadlines(a), today);
			const nb = nextDeadlineDate(grantDeadlines(b), today);
			if (na && nb) return na.localeCompare(nb);
			if (na) return -1;
			if (nb) return 1;
			return a.name.localeCompare(b.name);
		});
}

export async function getGrantBySlug(
	db: D1Database,
	slug: string,
): Promise<Grant | null> {
	const row = await db
		.prepare('SELECT * FROM grants WHERE slug = ? LIMIT 1')
		.bind(slug)
		.first<Grant>();
	return row ?? null;
}

export function formatAmount(grant: Grant): string {
	if (grant.amount_notes) return grant.amount_notes;
	if (grant.amount_min == null && grant.amount_max == null) return 'Amount varies';
	const fmt = (n: number) =>
		new Intl.NumberFormat('en-CA', {
			style: 'currency',
			currency: 'CAD',
			maximumFractionDigits: 0,
		}).format(n);
	if (grant.amount_min != null && grant.amount_max != null) {
		return `${fmt(grant.amount_min)} – ${fmt(grant.amount_max)}`;
	}
	if (grant.amount_max != null) return `Up to ${fmt(grant.amount_max)}`;
	return `From ${fmt(grant.amount_min!)}`;
}

/** Single-line summary (list cards). Prefer next upcoming ISO date. */
export function formatDeadline(grant: Grant): string {
	if (grant.status === 'rolling') return 'Rolling / ongoing';
	const deadlines = grantDeadlines(grant);
	const next = nextDeadlineDate(deadlines);
	if (next) {
		const hit = deadlines.find((d) => d.date === next);
		const label = hit?.label ? ` (${hit.label})` : '';
		return `${formatIsoDateEnCa(next)}${label}`;
	}
	if (deadlines.length) {
		const last = deadlines[deadlines.length - 1];
		return `Closed · last ${formatIsoDateEnCa(last.date)}`;
	}
	if (grant.deadline_notes) return grant.deadline_notes;
	return 'See funder site';
}

export function applicantLabel(type: Grant['applicant_types']): string {
	switch (type) {
		case 'individual':
			return 'Individuals';
		case 'organization':
			return 'Organizations';
		case 'both':
			return 'Individuals & organizations';
	}
}

export { todayToronto, formatIsoDateEnCa, nextDeadlineDate };
export type { GrantDeadline };
