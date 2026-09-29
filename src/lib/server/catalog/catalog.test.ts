import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testing';
import type { AppDatabase } from '../db/client';
import { song } from '../db/schema';
import { ingestCatalog } from './ingest';
import { getSongById, listSongs, searchSongs } from './search';

let db: AppDatabase;

beforeEach(() => {
	db = createTestDb();
});

const sample = [
	{ title: 'Bohemian Rhapsody', artist: 'Queen' },
	{ title: 'bohemian rhapsody', artist: 'QUEEN' },
	{ title: 'Dancing Queen', artist: 'ABBA' },
	{ title: '   ', artist: 'Nobody' }
];

describe('ingestCatalog', () => {
	it('inserts de-duplicated songs and reports accurate counts', () => {
		const summary = ingestCatalog(db, sample);
		expect(summary).toEqual({ received: 4, imported: 3, created: 2, updated: 1, skipped: 1 });
		expect(listSongs(db)).toHaveLength(2);
	});

	it('refreshes existing songs instead of duplicating them', () => {
		ingestCatalog(db, sample);
		const summary = ingestCatalog(db, [{ title: 'Bohemian Rhapsody!', artist: 'Queen' }]);

		expect(summary.created).toBe(0);
		expect(summary.updated).toBe(1);

		const rows = listSongs(db);
		expect(rows).toHaveLength(2);
		expect(rows.find((row) => row.normalizedArtist === 'queen')?.title).toBe('Bohemian Rhapsody!');
	});
});

describe('searchSongs', () => {
	beforeEach(() => {
		ingestCatalog(db, [
			{ title: 'Bohemian Rhapsody', artist: 'Queen' },
			{ title: 'Dancing Queen', artist: 'ABBA' },
			{ title: 'Beat It', artist: 'Michael Jackson' },
			{ title: 'Café Chanson', artist: 'Édith Piaf' }
		]);
	});

	it('finds songs by title prefix', () => {
		expect(searchSongs(db, 'bohem').map((row) => row.title)).toContain('Bohemian Rhapsody');
	});

	it('finds songs by artist', () => {
		expect(searchSongs(db, 'abba')[0]?.title).toBe('Dancing Queen');
	});

	it('is case and accent insensitive', () => {
		expect(searchSongs(db, 'CAFE')).toHaveLength(1);
		expect(searchSongs(db, 'edith')).toHaveLength(1);
	});

	it('returns nothing for blank queries', () => {
		expect(searchSongs(db, '   ')).toEqual([]);
	});

	it('keeps the full-text index in sync when songs are deleted', () => {
		const target = searchSongs(db, 'beat it')[0];
		expect(target).toBeDefined();

		db.delete(song).where(eq(song.id, target!.id)).run();

		expect(searchSongs(db, 'beat it')).toEqual([]);
	});

	it('keeps the full-text index in sync when songs are updated', () => {
		const target = searchSongs(db, 'beat it')[0]!;
		db.update(song)
			.set({ title: 'Smooth Criminal', normalizedTitle: 'smooth criminal' })
			.where(eq(song.id, target.id))
			.run();

		expect(searchSongs(db, 'beat it')).toEqual([]);
		expect(searchSongs(db, 'smooth')).toHaveLength(1);
	});

	it('tolerates typos (fuzzy search)', () => {
		expect(searchSongs(db, 'bohemain rhapsody').map((row) => row.title)).toContain(
			'Bohemian Rhapsody'
		);
		expect(searchSongs(db, 'dancign queen')[0]?.title).toBe('Dancing Queen');
	});

	it('sorts matches by artist or song title', () => {
		expect(searchSongs(db, 'queen', { sort: 'artist' }).map((row) => row.title)).toEqual([
			'Dancing Queen',
			'Bohemian Rhapsody'
		]);
		expect(searchSongs(db, 'queen', { sort: 'title' }).map((row) => row.title)).toEqual([
			'Bohemian Rhapsody',
			'Dancing Queen'
		]);
	});
});

describe('listSongs', () => {
	it('sorts alphabetically by artist (default) or title', () => {
		ingestCatalog(db, [
			{ title: 'Ziggy Stardust', artist: 'Alpha' },
			{ title: 'Aardvark', artist: 'Beta' }
		]);

		expect(listSongs(db, { sort: 'artist' }).map((row) => row.artist)).toEqual(['Alpha', 'Beta']);
		expect(listSongs(db, { sort: 'title' }).map((row) => row.title)).toEqual([
			'Aardvark',
			'Ziggy Stardust'
		]);
	});
});

describe('catalog lookups', () => {
	it('finds a song by id', () => {
		ingestCatalog(db, sample);
		const first = listSongs(db)[0];
		expect(getSongById(db, first.id)?.id).toBe(first.id);
	});
});
