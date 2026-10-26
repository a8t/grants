import { englishDateToIso, normalizeDeadlines, type GrantDeadline } from '@/lib/deadlines';
import { canonicalizeUrl, politeFetch, stripTags } from '../fetch';
import type { AdapterResult, DiscoveryAdapter, DiscoveredGrant } from '../types';

const LIST = 'https://torontoartscouncil.org/grants/';

function mapApplicants(raw: string | undefined): DiscoveredGrant['applicantTypes'] {
	if (!raw) return 'both';
	const hasInd = raw.includes('individual');
	const hasOrg = raw.includes('organization') || raw.includes('collective');
	if (hasInd && hasOrg) return 'both';
	if (hasInd) return 'individual';
	if (hasOrg) return 'organization';
	return 'both';
}

function parseDeadlinesFromText(text: string): {
	deadlines: GrantDeadline[];
	notes: string | null;
	rolling: boolean;
} {
	const t = text.trim();
	if (!t) return { deadlines: [], notes: null, rolling: false };
	if (/rolling/i.test(t)) return { deadlines: [], notes: 'Rolling deadline', rolling: true };

	const deadlines: GrantDeadline[] = [];
	const re =
		/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi;
	let m: RegExpExecArray | null;
	let idx = 0;
	while ((m = re.exec(t))) {
		const iso = englishDateToIso(m[1], m[2], m[3]);
		if (iso) {
			idx += 1;
			deadlines.push({
				date: iso,
				label: idx > 1 ? `intake ${idx}` : null,
			});
		}
	}
	const normalized = normalizeDeadlines(deadlines);
	return {
		deadlines: normalized,
		notes: normalized.length ? null : t,
		rolling: false,
	};
}

export const tacAdapter: DiscoveryAdapter = {
	key: 'tac',
	listUrl: LIST,
	async discover(): Promise<AdapterResult> {
		const fetched = await politeFetch(LIST);
		if (!fetched.ok) {
			return { adapterKey: 'tac', ok: false, items: [], error: fetched.error };
		}

		const items: DiscoveredGrant[] = [];
		const cardRe =
			/<article[^>]*class="[^"]*grant-card[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
		let match: RegExpExecArray | null;
		while ((match = cardRe.exec(fetched.html))) {
			const block = match[0];
			const title = stripTags(
				(block.match(/<h1[^>]*class="[^"]*grant-card-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
					[])[1] || '',
			);
			const href = (block.match(/<a[^>]*class="[^"]*grant-card-link[^"]*"[^>]*href="([^"]+)"/i) ||
				[])[1];
			if (!title || !href) continue;
			const desc = stripTags(
				(block.match(
					/<div[^>]*class="[^"]*grant-card-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
				) || [])[1] || '',
			);
			const deadlineRaw = stripTags(
				(block.match(
					/<div[^>]*class="[^"]*grant-card-deadlines[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
				) || [])[1] || '',
			);
			const applicants = (block.match(/data-grants_applicant_types="([^"]*)"/i) || [])[1];
			const url = canonicalizeUrl(href);
			const dl = parseDeadlinesFromText(deadlineRaw);
			items.push({
				title,
				funder: 'Toronto Arts Council',
				url,
				deadlines: dl.deadlines,
				deadlineAt: dl.deadlines[0]?.date ?? null,
				deadlineNotes: dl.notes,
				rawExcerpt: desc || null,
				applicantTypes: mapApplicants(applicants),
				provinceScope: 'ON',
				disciplines: [],
				dedupeKey: `tac:${url}`,
			});
		}

		return { adapterKey: 'tac', ok: true, items };
	},
};
