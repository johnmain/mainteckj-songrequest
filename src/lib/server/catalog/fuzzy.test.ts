import { describe, expect, it } from 'vitest';
import { bigrams, diceCoefficient, rankSongs, scoreText, tokenPrefixCoverage } from './fuzzy';

describe('bigrams', () => {
	it('produces overlapping character pairs', () => {
		expect(bigrams('queen')).toEqual(['qu', 'ue', 'ee', 'en']);
	});
});

describe('diceCoefficient', () => {
	it('returns 1 for identical strings', () => {
		expect(diceCoefficient('bohemian', 'bohemian')).toBe(1);
	});

	it('returns 0 when there is no overlap', () => {
		expect(diceCoefficient('queen', 'xyz')).toBe(0);
	});

	it('scores expected typos highly', () => {
		expect(diceCoefficient('bohemain', 'bohemian')).toBeGreaterThan(0.5);
		expect(diceCoefficient('dancign', 'dancing')).toBeGreaterThan(0.4);
	});
});

describe('tokenPrefixCoverage', () => {
	it('measures how many query tokens are covered', () => {
		expect(tokenPrefixCoverage('danc que', 'dancing queen')).toBe(1);
		expect(tokenPrefixCoverage('danc nope', 'dancing queen')).toBe(0.5);
	});
});

describe('scoreText', () => {
	it('gives an exact match the top score', () => {
		expect(scoreText('dancing queen', 'dancing queen')).toBe(1);
	});

	it('rewards prefixes', () => {
		expect(scoreText('danc', 'dancing queen')).toBeGreaterThan(scoreText('ance', 'dancing queen'));
	});

	it('keeps an exact match above a longer prefix', () => {
		expect(scoreText('queen', 'queen')).toBeGreaterThan(scoreText('queen', 'queencard'));
	});

	it('ranks a typo above an unrelated title', () => {
		expect(scoreText('bohemain', 'bohemian rhapsody')).toBeGreaterThan(
			scoreText('bohemain', 'dancing queen')
		);
	});
});

describe('rankSongs', () => {
	const songs = [
		{ normalizedTitle: 'dancing queen', normalizedArtist: 'abba' },
		{ normalizedTitle: 'bohemian rhapsody', normalizedArtist: 'queen' },
		{ normalizedTitle: 'beat it', normalizedArtist: 'michael jackson' }
	];

	it('orders exact artist matches first', () => {
		expect(rankSongs('abba', songs)[0].song.normalizedArtist).toBe('abba');
	});

	it('matches across typos', () => {
		expect(rankSongs('bohemain rhapsody', songs)[0].song.normalizedTitle).toBe('bohemian rhapsody');
	});
});
