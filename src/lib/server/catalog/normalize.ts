// eslint-disable-next-line no-misleading-character-class -- intentionally strips Latin combining diacritics
const COMBINING_MARKS = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff]/g;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/**
 * Canonical form used for de-duplication and matching:
 * accent-stripped, lower-cased and stripped of punctuation.
 * Keeps Unicode letters/numbers so non-Latin titles survive.
 */
export function normalizeText(value: string): string {
	return value
		.normalize('NFKD')
		.replace(COMBINING_MARKS, '')
		.normalize('NFC')
		.toLowerCase()
		.replace(NON_ALPHANUMERIC, ' ')
		.trim();
}

/** Stable de-duplication key for a title + artist pair. */
export function normalizeSongKey(title: string, artist: string): string {
	return `${normalizeText(title)}|${normalizeText(artist)}`;
}

/**
 * Builds a safe FTS5 MATCH expression from free-text input.
 * Every token is quoted and treated as a prefix query.
 */
export function buildFtsQuery(query: string, maxTokens = 12): string {
	return normalizeText(query)
		.split(' ')
		.filter(Boolean)
		.slice(0, maxTokens)
		.map((token) => `"${token.replace(/"/g, '""')}"*`)
		.join(' ');
}
