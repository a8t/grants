import { getRobots, isPathAllowed, sleep } from './robots';

export const BOT_UA =
	'GrantFinderBot/0.1 (+https://canada-grant-finder.andy8tran.workers.dev; research)';

export async function politeFetch(url: string): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { ok: false, error: `Invalid URL: ${url}` };
	}

	const robots = await getRobots(parsed.origin, BOT_UA);
	if (!isPathAllowed(robots, parsed.pathname)) {
		return {
			ok: false,
			error: `Blocked by robots.txt for ${parsed.origin}${parsed.pathname}`,
		};
	}

	await sleep(Math.max(1000, robots.crawlDelaySec * 1000));

	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent': BOT_UA,
				Accept: 'text/html,application/xhtml+xml',
			},
			redirect: 'follow',
		});
		if (!res.ok) return { ok: false, error: `HTTP ${res.status} for ${url}` };
		const html = await res.text();
		return { ok: true, html };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'fetch failed' };
	}
}

export function canonicalizeUrl(raw: string): string {
	try {
		const u = new URL(raw);
		u.hash = '';
		['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) =>
			u.searchParams.delete(k),
		);
		let path = u.pathname.replace(/\/+$/, '') || '/';
		return `${u.origin}${path}${u.search}`;
	} catch {
		return raw.trim();
	}
}

export function slugify(input: string): string {
	return input
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/[\s_]+/g, '-')
		.replace(/-+/g, '-')
		.slice(0, 80);
}

export function decodeEntities(s: string): string {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ');
}

export function stripTags(html: string): string {
	return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}
