/**
 * Lightweight fuzzy matching used to rank catalog search results. Character
 * bigram similarity (Sørensen–Dice) tolerates typos and word-order changes,
 * which plain FTS prefix matching cannot do.
 */

/** Minimum score for a result to be considered a match. */
export const FUZZY_MIN_SCORE = 0.34;

/** Splits a normalized string into overlapping character bigrams. */
export function bigrams(value: string): string[] {
	const compact = value.replace(/\s+/g, ' ').trim();
	const grams: string[] = [];
	for (let i = 0; i < compact.length - 1; i++) {
		grams.push(compact.slice(i, i + 2));
	}
	return grams;
}

/** Sørensen–Dice coefficient over character bigrams, in the range 0..1. */
export function diceCoefficient(a: string, b: string): number {
	if (!a || !b) return 0;
	if (a === b) return 1;

	const aGrams = bigrams(a);
	const bGrams = bigrams(b);
	if (aGrams.length === 0 || bGrams.length === 0) return a === b ? 1 : 0;

	const counts = new Map<string, number>();
	for (const gram of aGrams) counts.set(gram, (counts.get(gram) ?? 0) + 1);

	let intersection = 0;
	for (const gram of bGrams) {
		const remaining = counts.get(gram) ?? 0;
		if (remaining > 0) {
			intersection++;
			counts.set(gram, remaining - 1);
		}
	}

	return (2 * intersection) / (aGrams.length + bGrams.length);
}

/** Fraction of query tokens that are a prefix of some token in `text`. */
export function tokenPrefixCoverage(query: string, text: string): number {
	const queryTokens = query.split(' ').filter(Boolean);
	if (queryTokens.length === 0) return 0;

	const textTokens = text.split(' ').filter(Boolean);
	let covered = 0;
	for (const queryToken of queryTokens) {
		if (textTokens.some((token) => token === queryToken || token.startsWith(queryToken))) {
			covered++;
		}
	}

	return covered / queryTokens.length;
}

/** Similarity between a query and a single field, in the range 0..1. */
export function scoreText(query: string, text: string): number {
	if (!query || !text) return 0;
	if (text === query) return 1;

	const dice = diceCoefficient(query, text);
	const prefixBonus = text.startsWith(query) ? 0.12 : 0;
	const coverageBonus = tokenPrefixCoverage(query, text) * 0.25;

	// Capped below 1 so an exact field match always outranks a fuzzier one.
	return Math.min(0.99, dice + prefixBonus + coverageBonus);
}

export interface RankedSong<T> {
	song: T;
	score: number;
}

/**
 * Scores songs against a normalized query, keeping the best of the title and
 * artist fields, and returns them sorted by descending relevance.
 */
export function rankSongs<T extends { normalizedTitle: string; normalizedArtist: string }>(
	query: string,
	songs: T[]
): RankedSong<T>[] {
	return songs
		.map((song) => ({
			song,
			score: Math.max(
				scoreText(query, song.normalizedTitle),
				scoreText(query, song.normalizedArtist)
			)
		}))
		.sort((a, b) => b.score - a.score);
}
