import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, decodeEntities, slugify, stripTags } from '@/lib/discovery/fetch';

describe('slugify', () => {
	it('lowercases, strips punctuation, collapses separators', () => {
		expect(slugify('  Project Grants — Individuals!! ')).toBe('project-grants-individuals');
		expect(slugify('Café Théâtre')).toBe('cafe-theatre');
	});

	it('caps length at 80', () => {
		expect(slugify('a'.repeat(100)).length).toBe(80);
	});
});

describe('canonicalizeUrl + dedupe key shape', () => {
	it('strips hash and utm params', () => {
		expect(
			canonicalizeUrl(
				'https://Example.com/path/?utm_source=x&utm_medium=y&keep=1#section',
			),
		).toBe('https://example.com/path?keep=1');
	});

	it('builds adapter-style dedupe keys from canonical URLs', () => {
		const url = canonicalizeUrl('https://torontoartscouncil.org/grants/foo/?utm_campaign=a');
		expect(`tac:${url}`).toBe('tac:https://torontoartscouncil.org/grants/foo');
		expect(`oac:${canonicalizeUrl('https://www.arts.on.ca/x/')}`).toBe(
			'oac:https://www.arts.on.ca/x',
		);
	});
});

describe('HTML helpers', () => {
	it('strips tags and decodes entities', () => {
		expect(stripTags('<p>Hello&nbsp;<b>world</b>&amp;co</p>')).toMatch(/Hello\s+world\s*&co/);
		expect(decodeEntities('&#39;&quot;')).toBe(`'"`);
	});
});
