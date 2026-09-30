import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, createTestUser } from '../db/testing';
import { song, songRequest } from '../db/schema';
import type { AppDatabase } from '../db/client';
import { pushSingerQueue } from './pushQueue';

let db: AppDatabase;

beforeEach(() => {
	db = createTestDb();
	createTestUser(db, { name: 'Alice' });
});

/** All requests for the test singer, keyed by song title. */
function requestsByTitle() {
	return db
		.select({
			id: songRequest.id,
			title: song.title,
			status: songRequest.status,
			played: songRequest.hostPlayed,
			delivered: songRequest.deliveredAt
		})
		.from(songRequest)
		.innerJoin(song, eq(songRequest.songId, song.id))
		.all();
}

describe('pushSingerQueue', () => {
	it('reports an unknown singer', () => {
		expect(pushSingerQueue(db, { singerName: 'Nobody', songs: [] }).status).toBe('unknown-singer');
	});

	it('creates approved, already-delivered requests and catalog songs', () => {
		const result = pushSingerQueue(db, {
			singerName: 'alice',
			songs: [
				{ title: 'Song A', artist: 'Band' },
				{ title: 'Song B', artist: 'Band', played: true }
			]
		});

		expect(result.status).toBe('ok');
		if (result.status !== 'ok') return;
		expect(result).toMatchObject({ created: 2, updated: 0, removed: 0 });

		const rows = requestsByTitle();
		expect(rows).toHaveLength(2);
		expect(rows.every((r) => r.status === 'approved' && r.delivered !== null)).toBe(true);
		expect(rows.find((r) => r.title === 'Song B')?.played).toBe(true);
		expect(rows.find((r) => r.title === 'Song A')?.played).toBe(false);

		// The host can link each queued song back to its new request.
		expect(result.requests).toHaveLength(2);
		const ids = result.requests.map((r) => r.requestId);
		expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
		expect(new Set(ids).size).toBe(2);
	});

	it('updates the played flag of an existing request', () => {
		pushSingerQueue(db, { singerName: 'Alice', songs: [{ title: 'Song A', artist: 'Band' }] });
		const result = pushSingerQueue(db, {
			singerName: 'Alice',
			songs: [{ title: 'Song A', artist: 'Band', played: true }]
		});

		expect(result.status).toBe('ok');
		if (result.status !== 'ok') return;
		expect(result).toMatchObject({ created: 0, updated: 1, removed: 0 });
		expect(requestsByTitle()[0].played).toBe(true);
		// Updating returns the existing request id, not a new one.
		expect(result.requests[0].requestId).toBe(requestsByTitle()[0].id);
	});

	it('removes active requests no longer in the queue but keeps played history', () => {
		pushSingerQueue(db, {
			singerName: 'Alice',
			songs: [
				{ title: 'Song A', artist: 'Band' },
				{ title: 'Song B', artist: 'Band' }
			]
		});
		const b = requestsByTitle().find((r) => r.title === 'Song B');
		db.update(songRequest).set({ status: 'played' }).where(eq(songRequest.id, b!.id)).run();

		// Song B is played (not active), Song C is dropped.
		const result = pushSingerQueue(db, {
			singerName: 'Alice',
			songs: [{ title: 'Song A', artist: 'Band' }]
		});

		expect(result).toMatchObject({ status: 'ok', removed: 0 });
		expect(
			requestsByTitle()
				.map((r) => r.title)
				.sort()
		).toEqual(['Song A', 'Song B']);

		// Re-activate Song B and drop it: now it is pruned.
		db.update(songRequest).set({ status: 'approved' }).where(eq(songRequest.id, b!.id)).run();
		const pruned = pushSingerQueue(db, {
			singerName: 'Alice',
			songs: [{ title: 'Song A', artist: 'Band' }]
		});
		expect(pruned).toMatchObject({ status: 'ok', removed: 1 });
		expect(requestsByTitle().map((r) => r.title)).toEqual(['Song A']);
	});

	it('dry run reports the plan without writing anything', () => {
		pushSingerQueue(db, {
			singerName: 'Alice',
			songs: [
				{ title: 'Song A', artist: 'Band' },
				{ title: 'Song B', artist: 'Band' }
			]
		});
		const before = requestsByTitle().length;

		const preview = pushSingerQueue(db, {
			singerName: 'Alice',
			songs: [
				{ title: 'Song A', artist: 'Band' },
				{ title: 'Song C', artist: 'Band' }
			],
			dryRun: true
		});

		expect(preview).toMatchObject({
			status: 'ok',
			dryRun: true,
			created: 1, // Song C (new request + new catalog song)
			updated: 1, // Song A
			removed: 1 // Song B dropped from the queue
		});
		expect(requestsByTitle()).toHaveLength(before);
		expect(
			db
				.select()
				.from(song)
				.all()
				.some((s) => s.title === 'Song C')
		).toBe(false);
		expect((preview as { requests?: unknown[] }).requests).toEqual([]);
	});

	it('skips blank rows and de-duplicates repeated songs', () => {
		const result = pushSingerQueue(db, {
			singerName: 'Alice',
			songs: [
				{ title: '', artist: 'Band' },
				{ title: 'Song A', artist: 'Band' },
				{ title: 'Song A', artist: 'Band', played: true }
			]
		});

		expect(result).toMatchObject({ status: 'ok', created: 1, skipped: 1 });
		expect(requestsByTitle()).toHaveLength(1);
		expect(requestsByTitle()[0].played).toBe(true);
	});
});
