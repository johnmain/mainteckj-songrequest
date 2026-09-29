import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, createTestUser } from '../db/testing';
import type { AppDatabase } from '../db/client';
import { ingestCatalog } from '../catalog/ingest';
import { listSongs } from '../catalog/search';
import { countSongHistory, listSongHistory, recordSongHistory } from './history';

let db: AppDatabase;

beforeEach(() => {
	db = createTestDb();
	ingestCatalog(db, [
		{ title: 'Bohemian Rhapsody', artist: 'Queen' },
		{ title: 'Dancing Queen', artist: 'ABBA' },
		{ title: 'Beat It', artist: 'Michael Jackson' }
	]);
});

function songByArtist(artist: string) {
	const match = listSongs(db).find((row) => row.artist === artist);
	if (!match) throw new Error(`Missing test song for ${artist}`);
	return match;
}

describe('recordSongHistory / listSongHistory', () => {
	it('returns history joined with song details, newest first', () => {
		const user = createTestUser(db);
		recordSongHistory(db, {
			userId: user.id,
			songId: songByArtist('Queen').id,
			sungAt: new Date('2026-01-01T00:00:00Z')
		});
		recordSongHistory(db, {
			userId: user.id,
			songId: songByArtist('ABBA').id,
			sungAt: new Date('2026-02-01T00:00:00Z')
		});

		const history = listSongHistory(db, user.id);
		expect(history.map((entry) => entry.title)).toEqual(['Dancing Queen', 'Bohemian Rhapsody']);
		expect(history[0]).toMatchObject({ artist: 'ABBA' });
	});

	it('paginates the history', () => {
		const user = createTestUser(db);
		for (const artist of ['Queen', 'ABBA', 'Michael Jackson']) {
			recordSongHistory(db, { userId: user.id, songId: songByArtist(artist).id });
		}

		expect(listSongHistory(db, user.id, { limit: 2 })).toHaveLength(2);
		expect(listSongHistory(db, user.id, { limit: 2, offset: 2 })).toHaveLength(1);
	});

	it("counts only the user's entries", () => {
		const user = createTestUser(db);
		const other = createTestUser(db);
		recordSongHistory(db, { userId: user.id, songId: songByArtist('Queen').id });
		recordSongHistory(db, { userId: other.id, songId: songByArtist('ABBA').id });

		expect(countSongHistory(db, user.id)).toBe(1);
		expect(listSongHistory(db, other.id)[0]?.artist).toBe('ABBA');
	});

	it('stores the originating request id when provided', () => {
		const user = createTestUser(db);
		const entry = recordSongHistory(db, {
			userId: user.id,
			songId: songByArtist('Queen').id,
			requestId: null
		});

		expect(entry.requestId).toBeNull();
		expect(entry.sungAt).toBeInstanceOf(Date);
	});
});
