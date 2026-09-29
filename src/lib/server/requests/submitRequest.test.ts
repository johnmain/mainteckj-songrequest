import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, createTestUser } from '../db/testing';
import type { User } from '../db/schema';
import type { AppDatabase } from '../db/client';
import { ingestCatalog } from '../catalog/ingest';
import { listSongs } from '../catalog/search';
import { listUserRequests } from './requests';
import { submitSongRequest } from './submitRequest';

let db: AppDatabase;
let user: User;
let songId: string;

beforeEach(() => {
	db = createTestDb();
	user = createTestUser(db, { name: 'Ada' });
	ingestCatalog(db, [{ title: 'Bohemian Rhapsody', artist: 'Queen' }]);
	songId = listSongs(db)[0].id;
});

describe('submitSongRequest', () => {
	it('queues a request for the host to pull', () => {
		const result = submitSongRequest(db, { user, songId });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.duplicate).toBe(false);
		expect(result.request.status).toBe('pending');
		expect(result.request.deliveredAt).toBeNull();
	});

	it('trims the optional note', () => {
		const result = submitSongRequest(db, { user, songId, note: '  Please!  ' });
		expect(result.ok && result.request.note).toBe('Please!');
	});

	it('treats a second pending request for the same song as a duplicate', () => {
		submitSongRequest(db, { user, songId });
		const second = submitSongRequest(db, { user, songId });

		expect(second.ok && second.duplicate).toBe(true);
		expect(listUserRequests(db, user.id)).toHaveLength(1);
	});

	it('rejects a song that is not in the catalog', () => {
		expect(submitSongRequest(db, { user, songId: 'missing' })).toEqual({
			ok: false,
			reason: 'song-not-found'
		});
	});
});
