import { describe, expect, it } from 'vitest';
import { parseCatalogExport } from './parse';

describe('parseCatalogExport', () => {
	it('parses JSON objects with flexible key casing', () => {
		expect(parseCatalogExport('[{"Title":"A","Artist":"B"}]')).toEqual([
			{ title: 'A', artist: 'B' }
		]);
	});

	it('parses JSON [title, artist] pairs', () => {
		expect(parseCatalogExport('[["A","B"]]')).toEqual([{ title: 'A', artist: 'B' }]);
	});

	it('parses JSON wrapped in a songs property', () => {
		expect(parseCatalogExport('{"songs":[{"title":"A","artist":"B"}]}')).toEqual([
			{ title: 'A', artist: 'B' }
		]);
	});

	it('parses CSV with a header row', () => {
		expect(parseCatalogExport('Title,Artist\nA,B')).toEqual([{ title: 'A', artist: 'B' }]);
	});

	it('parses CSV without a header row', () => {
		expect(parseCatalogExport('A,B')).toEqual([{ title: 'A', artist: 'B' }]);
	});

	it('handles quoted fields containing the delimiter', () => {
		expect(parseCatalogExport('Title,Artist\n"Hello, World",B')).toEqual([
			{ title: 'Hello, World', artist: 'B' }
		]);
	});

	it('detects tab-delimited exports', () => {
		expect(parseCatalogExport('Title\tArtist\nA\tB')).toEqual([{ title: 'A', artist: 'B' }]);
	});

	it('returns an empty array for blank input', () => {
		expect(parseCatalogExport('   ')).toEqual([]);
	});

	it('throws on malformed JSON', () => {
		expect(() => parseCatalogExport('[oops', 'json')).toThrowError(/Invalid JSON/);
	});
});
