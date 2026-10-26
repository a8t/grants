type RobotsRules = {
	crawlDelaySec: number;
	disallowAll: boolean;
	disallows: string[];
};

const cache = new Map<string, { at: number; rules: RobotsRules }>();

function parseRobots(text: string, userAgent: string): RobotsRules {
	const ua = userAgent.toLowerCase();
	const lines = text.split(/\r?\n/);
	let inStar = false;
	let inOurs = false;
	let starDisallowAll = false;
	let oursDisallowAll = false;
	const starDisallows: string[] = [];
	const oursDisallows: string[] = [];
	let crawlDelay = 2;

	for (const raw of lines) {
		const line = raw.split('#')[0].trim();
		if (!line) continue;
		const [k, ...rest] = line.split(':');
		const key = k.trim().toLowerCase();
		const val = rest.join(':').trim();
		if (key === 'user-agent') {
			const v = val.toLowerCase();
			inStar = v === '*';
			inOurs = ua.includes(v) || v.includes('grantfinder');
			continue;
		}
		if (key === 'disallow' && (inStar || inOurs)) {
			if (val === '/') {
				if (inOurs) oursDisallowAll = true;
				if (inStar) starDisallowAll = true;
			} else if (val) {
				if (inOurs) oursDisallows.push(val);
				if (inStar) starDisallows.push(val);
			}
		}
		if (key === 'crawl-delay' && (inStar || inOurs)) {
			const n = Number(val);
			if (!Number.isNaN(n) && n > crawlDelay) crawlDelay = n;
		}
	}

	const disallowAll = oursDisallowAll || (!inOurs && starDisallowAll);
	const disallows = oursDisallows.length ? oursDisallows : starDisallows;
	return { crawlDelaySec: crawlDelay, disallowAll, disallows };
}

export async function getRobots(origin: string, userAgent: string): Promise<RobotsRules> {
	const key = origin;
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < 1000 * 60 * 60) return hit.rules;

	try {
		const res = await fetch(`${origin}/robots.txt`, {
			headers: { 'User-Agent': userAgent },
		});
		if (res.status === 404) {
			const rules = { crawlDelaySec: 2, disallowAll: false, disallows: [] };
			cache.set(key, { at: Date.now(), rules });
			return rules;
		}
		if (!res.ok) {
			const rules = { crawlDelaySec: 5, disallowAll: false, disallows: [] };
			cache.set(key, { at: Date.now(), rules });
			return rules;
		}
		const text = await res.text();
		const rules = parseRobots(text, userAgent);
		cache.set(key, { at: Date.now(), rules });
		return rules;
	} catch {
		return { crawlDelaySec: 5, disallowAll: false, disallows: [] };
	}
}

export function isPathAllowed(rules: RobotsRules, path: string): boolean {
	if (rules.disallowAll) return false;
	return !rules.disallows.some((d) => d && path.startsWith(d));
}

export function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
