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

function parseDeadline(text: string): { at: string | null; notes: string | null; rolling: boolean } {
	const t = text.trim();
	if (/rolling/i.test(t)) return { at: null, notes: 'Rolling deadline', rolling: true };
	const m = t.match(
		/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
	);
	if (m) {
		const months: Record<string, string> = {
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
		};
		const mm = months[m[1].toLowerCase()];
		const dd = m[2].padStart(2, '0');
		return { at: `${m[3]}-${mm}-${dd}`, notes: t, rolling: false };
	}
	return { at: null, notes: t || null, rolling: false };
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
			const dl = parseDeadline(deadlineRaw);
			items.push({
				title,
				funder: 'Toronto Arts Council',
				url,
				deadlineAt: dl.at,
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
