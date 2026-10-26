import { stripTags } from '../fetch';

const MAX_CHARS = 12_000;
const MIN_CHARS = 280;

/** Strip scripts/styles/nav noise and truncate for LLM context. */
export function htmlToExtractText(html: string): { text: string; tooThin: boolean } {
	let t = html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ');

	// Drop common chrome
	t = t.replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, ' ');

	const text = stripTags(t)
		.replace(/\u00a0/g, ' ')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	if (text.length < MIN_CHARS) {
		return { text, tooThin: true };
	}

	if (text.length <= MAX_CHARS) {
		return { text, tooThin: false };
	}

	// Keep head + tail (deadlines often near top or bottom)
	const head = Math.floor(MAX_CHARS * 0.7);
	const tail = MAX_CHARS - head - 40;
	return {
		text: `${text.slice(0, head)}\n\n[...truncated...]\n\n${text.slice(-tail)}`,
		tooThin: false,
	};
}

export { MAX_CHARS, MIN_CHARS };
