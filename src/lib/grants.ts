import type { Grant, GrantListFilters } from './types';

const PROVINCE_ALIASES: Record<string, string[]> = {
	ON: ['ON', 'CA'],
	CA: ['CA'],
};

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

	if (filters.status && filters.status !== 'all') {
		clauses.push('status = ?');
		binds.push(filters.status);
	} else {
		clauses.push("status IN ('open', 'rolling')");
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
	return result.results ?? [];
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

export function formatDeadline(grant: Grant): string {
	if (grant.status === 'rolling') return 'Rolling / ongoing';
	if (grant.deadline_notes) return grant.deadline_notes;
	if (!grant.deadline_at) return 'See funder site';
	const d = new Date(`${grant.deadline_at}T12:00:00Z`);
	return new Intl.DateTimeFormat('en-CA', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC',
	}).format(d);
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
