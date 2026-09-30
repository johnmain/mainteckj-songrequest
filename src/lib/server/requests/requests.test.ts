import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, createTestUser } from '../db/testing';
import type { AppDatabase } from '../db/client';
import { ingestCatalog } from '../catalog/ingest';
import { listSongs } from '../catalog/search';
import { countSongHistory } from '../history/history';
import {
	claimPendingRequests,
	countUserRequests,
	createSongRequest,
	deleteRequestByHost,
	deleteSongRequest,
	findPendingRequest,
	getRequestById,
	listUserRequests,
	pendingQueueUpdates,
	pendingRemovals,
	setRequestedPlayed,
	updateRequestStatus
} from './requests';

let db: AppDatabase;
let userId: string;
let songId: string;

beforeEach(() => {
	db = createTestDb();
	userId = createTestUser(db).id;
	ingestCatalog(db, [{ title: 'Bohemian Rhapsody', artist: 'Queen' }]);
	songId = listSongs(db)[0].id;
});

describe('request queue', () => {
	it('creates pending requests joined with song details', () => {
		createSongRequest(db, { userId, songId });

		const [request] = listUserRequests(db, userId);
		expect(request).toMatchObject({
			title: 'Bohemian Rhapsody',
			artist: 'Queen',
			status: 'pending',
			deliveredAt: null
		});
		expect(countUserRequests(db, userId)).toBe(1);
	});

	it('finds an outstanding request but ignores finished ones', () => {
		const request = createSongRequest(db, { userId, songId });

		expect(findPendingRequest(db, userId, songId)?.id).toBe(request.id);

		updateRequestStatus(db, request.id, 'rejected');
		expect(findPendingRequest(db, userId, songId)).toBeUndefined();
	});

	it('records history when a request is played, exactly once', () => {
		const request = createSongRequest(db, { userId, songId });

		expect(updateRequestStatus(db, request.id, 'played')?.historyRecorded).toBe(true);
		expect(countSongHistory(db, userId)).toBe(1);

		updateRequestStatus(db, request.id, 'played');
		expect(countSongHistory(db, userId)).toBe(1);
	});

	it('returns undefined for unknown requests', () => {
		expect(updateRequestStatus(db, 'missing', 'approved')).toBeUndefined();
	});
});

describe('claimPendingRequests (host pull)', () => {
	it('returns pending requests once and marks them claimed', () => {
		const request = createSongRequest(db, { userId, songId, note: 'table 5' });

		const first = claimPendingRequests(db, 50);
		expect(first).toHaveLength(1);
		expect(first[0]).toMatchObject({
			id: request.id,
			note: 'table 5',
			song: { title: 'Bohemian Rhapsody', artist: 'Queen' },
			singer: { id: userId, name: 'Test Singer', stageName: null }
		});

		// A second poll returns nothing, and the row is marked claimed.
		expect(claimPendingRequests(db, 50)).toEqual([]);
		expect(getRequestById(db, request.id)?.deliveredAt).toBeInstanceOf(Date);
	});

	it('does not claim requests that are no longer pending', () => {
		const request = createSongRequest(db, { userId, songId });
		updateRequestStatus(db, request.id, 'rejected');

		expect(claimPendingRequests(db, 50)).toEqual([]);
	});
});

describe('played sync (host ↔ singer)', () => {
	it('records a singer toggle for the host to apply', () => {
		const request = createSongRequest(db, { userId, songId });

		expect(setRequestedPlayed(db, request.id, userId, true)).toBe('ok');
		expect(pendingQueueUpdates(db)).toEqual([{ id: request.id, played: true }]);
	});

	it("will not toggle another singer's request", () => {
		const other = createTestUser(db);
		const request = createSongRequest(db, { userId: other.id, songId });

		expect(setRequestedPlayed(db, request.id, userId, true)).toBe('not-found');
		expect(pendingQueueUpdates(db)).toEqual([]);
	});

	it('clears the pending toggle and records history when the host marks it played', () => {
		const request = createSongRequest(db, { userId, songId });
		setRequestedPlayed(db, request.id, userId, true);

		const result = updateRequestStatus(db, request.id, 'played');
		expect(result?.historyRecorded).toBe(true);
		expect(pendingQueueUpdates(db)).toEqual([]);

		const row = listUserRequests(db, userId)[0];
		expect(row.hostPlayed).toBe(true);
		expect(row.pendingPlayed).toBeNull();
	});

	it('reports unplayed when the host clears it for the next event', () => {
		const request = createSongRequest(db, { userId, songId });
		updateRequestStatus(db, request.id, 'played');
		setRequestedPlayed(db, request.id, userId, false);

		expect(pendingQueueUpdates(db)).toEqual([{ id: request.id, played: false }]);
		updateRequestStatus(db, request.id, 'approved');
		expect(listUserRequests(db, userId)[0].hostPlayed).toBe(false);
	});
});

describe('deleteSongRequest', () => {
	it('removes a pending request', () => {
		const request = createSongRequest(db, { userId, songId });

		expect(deleteSongRequest(db, request.id, userId)).toBe('deleted');
		expect(countUserRequests(db, userId)).toBe(0);
	});

	it('removes a rejected request too', () => {
		const request = createSongRequest(db, { userId, songId });
		updateRequestStatus(db, request.id, 'rejected');

		expect(deleteSongRequest(db, request.id, userId)).toBe('deleted');
		expect(countUserRequests(db, userId)).toBe(0);
	});

	it('refuses to remove a song that is already playing', () => {
		const request = createSongRequest(db, { userId, songId });
		updateRequestStatus(db, request.id, 'playing');

		expect(deleteSongRequest(db, request.id, userId)).toBe('not-deletable');
		expect(countUserRequests(db, userId)).toBe(1);
	});

	it("will not delete another singer's request", () => {
		const other = createTestUser(db);
		const request = createSongRequest(db, { userId: other.id, songId });

		expect(deleteSongRequest(db, request.id, userId)).toBe('not-found');
		expect(countUserRequests(db, other.id)).toBe(1);
	});

	it('reports unknown requests', () => {
		expect(deleteSongRequest(db, 'missing', userId)).toBe('not-found');
	});
});

describe('deleteSongRequest (already in the host queue)', () => {
	it('flags a claimed request for removal instead of deleting it', () => {
		const request = createSongRequest(db, { userId, songId });
		claimPendingRequests(db, 50); // host claims it → deliveredAt set

		expect(deleteSongRequest(db, request.id, userId)).toBe('pending-removal');

		// Hidden from the singer and the duplicate guard...
		expect(countUserRequests(db, userId)).toBe(0);
		expect(listUserRequests(db, userId)).toEqual([]);
		expect(findPendingRequest(db, userId, songId)).toBeUndefined();
		// ...and offered to the host on its next poll.
		expect(pendingRemovals(db)).toEqual([request.id]);
	});

	it('is not handed back to the host as a new request', () => {
		const request = createSongRequest(db, { userId, songId });
		claimPendingRequests(db, 50);
		deleteSongRequest(db, request.id, userId);

		expect(claimPendingRequests(db, 50)).toEqual([]);
	});

	it('deletes the request when the host acknowledges the removal', () => {
		const request = createSongRequest(db, { userId, songId });
		claimPendingRequests(db, 50);
		deleteSongRequest(db, request.id, userId);

		expect(deleteRequestByHost(db, request.id)).toBe(true);
		expect(getRequestById(db, request.id)).toBeUndefined();
		expect(pendingRemovals(db)).toEqual([]);
		expect(deleteRequestByHost(db, 'missing')).toBe(false);
	});
});
