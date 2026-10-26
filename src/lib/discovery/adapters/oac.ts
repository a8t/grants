import { canonicalizeUrl, politeFetch, slugify } from '../fetch';
import type { AdapterResult, DiscoveryAdapter, DiscoveredGrant } from '../types';

const LIST = 'https://www.arts.on.ca/grants/';

const SKIP =
	/\/grants\/(activity|discipline|general-granting|grants-advanced|accessibility-plan|nova|guide)/i;

function titleFromUrl(url: string): string {
	const slug = url.split('/').filter(Boolean).pop() || 'program';
	return decodeURIComponent(slug)
		.replace(/-/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.replace(/Ã.|â./g, '')
		.trim();
}

export const oacAdapter: DiscoveryAdapter = {
	key: 'oac',
	listUrl: LIST,
	async discover(): Promise<AdapterResult> {
		const fetched = await politeFetch(LIST);
		if (!fetched.ok) {
			return { adapterKey: 'oac', ok: false, items: [], error: fetched.error };
		}

		const hrefs = [
			...fetched.html.matchAll(
				/href="(https:\/\/www\.arts\.on\.ca\/grants\/[^"#?]+|\/grants\/[^"#?]+)"/gi,
			),
		].map((m) => {
			const raw = m[1];
			return raw.startsWith('http') ? raw : `https://www.arts.on.ca${raw}`;
		});

		const seen = new Set<string>();
		const items: DiscoveredGrant[] = [];
		for (const href of hrefs) {
			const url = canonicalizeUrl(href.split('?')[0]);
			if (SKIP.test(url)) continue;
			if (url === 'https://www.arts.on.ca/grants' || url.endsWith('/grants')) continue;
			if (seen.has(url)) continue;
			seen.add(url);
			const title = titleFromUrl(url);
			if (title.length < 4) continue;
			items.push({
				title,
				funder: 'Ontario Arts Council',
				url,
				deadlineAt: null,
				deadlineNotes: 'See program page / OAC deadlines calendar',
				rawExcerpt: `Discovered from OAC grants index (${slugify(title)}). Confirm deadline and eligibility on the program page before publishing.`,
				applicantTypes: 'both',
				provinceScope: 'ON',
				disciplines: [],
				dedupeKey: `oac:${url}`,
			});
		}

		return { adapterKey: 'oac', ok: true, items };
	},
};
