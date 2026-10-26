import { canonicalizeUrl, politeFetch, stripTags } from '../fetch';
import type { AdapterResult, DiscoveryAdapter, DiscoveredGrant } from '../types';

const LIST = 'https://www.canada.ca/en/canadian-heritage/services/funding.html';

/** Keep arts/culture-adjacent programs; drop pure sport. */
const INCLUDE =
	/arts|culture|heritage|book|music|media|festival|creative|museum|cultural|presentation|periodical|export canada|narratives|celebrate canada/i;
const EXCLUDE =
	/athlete|sport Canada|olympic|paralympic|physical activity|court challenges|destination clic/i;

export const canadianHeritageAdapter: DiscoveryAdapter = {
	key: 'canadian_heritage',
	listUrl: LIST,
	async discover(): Promise<AdapterResult> {
		const fetched = await politeFetch(LIST);
		if (!fetched.ok) {
			return {
				adapterKey: 'canadian_heritage',
				ok: false,
				items: [],
				error: fetched.error,
			};
		}

		const items: DiscoveredGrant[] = [];
		const rowRe = /<tr[\s\S]*?<\/tr>/gi;
		let row: RegExpExecArray | null;
		while ((row = rowRe.exec(fetched.html))) {
			const cells = [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
				c[1],
			);
			if (cells.length < 2) continue;
			const nameHtml = cells[0];
			const descHtml = cells[1];
			const link = (nameHtml.match(/href="([^"]+)"/i) || [])[1];
			const title = stripTags(nameHtml);
			const excerpt = stripTags(descHtml);
			if (!title || !link) continue;
			if (EXCLUDE.test(title) && !INCLUDE.test(title)) continue;
			if (!INCLUDE.test(`${title} ${excerpt}`)) continue;

			const abs = link.startsWith('http')
				? link
				: `https://www.canada.ca${link.startsWith('/') ? '' : '/'}${link}`;
			const url = canonicalizeUrl(abs);
			items.push({
				title,
				funder: 'Canadian Heritage',
				url,
				deadlineAt: null,
				deadlineNotes: 'See program page for current intake',
				rawExcerpt: excerpt.slice(0, 600),
				applicantTypes: 'organization',
				provinceScope: 'CA',
				disciplines: [],
				dedupeKey: `pch:${url}`,
			});
		}

		return { adapterKey: 'canadian_heritage', ok: true, items };
	},
};
