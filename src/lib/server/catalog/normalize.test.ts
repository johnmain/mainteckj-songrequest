import { describe, expect, it } from 'vitest';
import { buildFtsQuery, normalizeSongKey, normalizeText } from './normalize';

describe('normalizeText', () => {
	it('lower-cases and strips punctuation', () => {
		expect(normalizeText('Don’t Stop Believin’!')).toBe('don t stop believin');
	});

	it('strips accents', () => {
		expect(normalizeText('Beyoncé')).toBe('beyonce');
	});

	it('keeps unicode letters for non-latin titles', () => {
		expect(normalizeText('残酷な天使のテーゼ')).toBe('残酷な天使のテーゼ');
	});

	it('collapses surrounding and repeated whitespace', () => {
		expect(normalizeText('  A   B  ')).toBe('a b');
	});
});

describe('normalizeSongKey', () => {
	it('treats casing and punctuation variants as the same song', () => {
		expect(normalizeSongKey('Bohemian Rhapsody', 'Queen')).toBe(
			normalizeSongKey('bohemian rhapsody!', 'QUEEN')
		);
	});

	it('distinguishes different artists', () => {
		expect(normalizeSongKey('Hurt', 'Nine Inch Nails')).not.toBe(
			normalizeSongKey('Hurt', 'Johnny Cash')
		);
	});
});

describe('buildFtsQuery', () => {
	it('quotes tokens and marks them as prefixes', () => {
		expect(buildFtsQuery('Don’t')).toBe('"don"* "t"*');
	});

	it('returns an empty string for blank input', () => {
		expect(buildFtsQuery('   ')).toBe('');
	});

	it('respects the token limit', () => {
		expect(buildFtsQuery('a b c d', 2)).toBe('"a"* "b"*');
	});
});
