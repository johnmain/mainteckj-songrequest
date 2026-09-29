import { and, count, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import {
	singerProfile,
	song,
	songHistory,
	songRequest,
	user,
	type SongRequest
} from '../db/schema';
import type { AppDatabase } from '../db/client';
import { recordSongHistory } from '../history/history';

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'playing', 'played'] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface RequestWithSong {
	id: string;
	userId: string;
	songId: string;
	title: string;
	artist: string;
	status: RequestStatus;
	note: string | null;
	deliveredAt: Date | null;
	hostPlayed: boolean | null;
	pendingPlayed: boolean | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface RequestOptions {
	limit?: number;
	offset?: number;
}

/** Shape handed to the desktop host when it polls for new requests. */
export interface HostPendingRequest {
	id: string;
	song: { id: string; title: string; artist: string };
	singer: { id: string; name: string | null; stageName: string | null };
	note: string | null;
	requestedAt: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function clampLimit(limit: number | undefined): number {
	return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
}

export function getRequestById(db: AppDatabase, id: string): SongRequest | undefined {
	return db.select().from(songRequest).where(eq(songRequest.id, id)).get();
}

/** Existing unfinished request for the same singer and song, if any. */
export function findPendingRequest(
	db: AppDatabase,
	userId: string,
	songId: string
): SongRequest | undefined {
	return db
		.select()
		.from(songRequest)
		.where(
			and(
				eq(songRequest.userId, userId),
				eq(songRequest.songId, songId),
				inArray(songRequest.status, ['pending', 'approved', 'playing'])
			)
		)
		.get();
}

export function createSongRequest(
	db: AppDatabase,
	input: { userId: string; songId: string; note?: string | null }
): SongRequest {
	return db
		.insert(songRequest)
		.values({
			userId: input.userId,
			songId: input.songId,
			note: input.note ?? null,
			status: 'pending'
		})
		.returning()
		.get();
}

export function listUserRequests(
	db: AppDatabase,
	userId: string,
	options: RequestOptions = {}
): RequestWithSong[] {
	return db
		.select({
			id: songRequest.id,
			userId: songRequest.userId,
			songId: songRequest.songId,
			title: song.title,
			artist: song.artist,
			status: songRequest.status,
			note: songRequest.note,
			deliveredAt: songRequest.deliveredAt,
			hostPlayed: songRequest.hostPlayed,
			pendingPlayed: songRequest.pendingPlayed,
			createdAt: songRequest.createdAt,
			updatedAt: songRequest.updatedAt
		})
		.from(songRequest)
		.innerJoin(song, eq(songRequest.songId, song.id))
		.where(eq(songRequest.userId, userId))
		.orderBy(desc(songRequest.createdAt))
		.limit(clampLimit(options.limit))
		.offset(Math.max(Math.trunc(options.offset ?? 0), 0))
		.all();
}

export function countUserRequests(db: AppDatabase, userId: string): number {
	return (
		db.select({ value: count() }).from(songRequest).where(eq(songRequest.userId, userId)).get()
			?.value ?? 0
	);
}

/** Statuses a singer may remove from their list: not started, or already decided. */
const DELETABLE_STATUSES: RequestStatus[] = ['pending', 'approved', 'rejected'];

export type DeleteRequestResult = 'deleted' | 'not-found' | 'not-deletable';

/**
 * Removes one of the singer's own requests. Allowed while it is pending,
 * approved, or rejected; a song that's already playing/played can't be removed.
 */
export function deleteSongRequest(
	db: AppDatabase,
	id: string,
	userId: string
): DeleteRequestResult {
	const request = getRequestById(db, id);
	if (!request || request.userId !== userId) return 'not-found';
	if (!DELETABLE_STATUSES.includes(request.status)) return 'not-deletable';

	db.delete(songRequest).where(eq(songRequest.id, id)).run();
	return 'deleted';
}

/**
 * Pull model: returns pending requests the host has not claimed yet and marks
 * them claimed (`delivered_at`) in the same call, so the next poll won't hand
 * the same request out twice.
 */
export function claimPendingRequests(db: AppDatabase, limit = 50): HostPendingRequest[] {
	const rows = db
		.select({
			id: songRequest.id,
			songId: songRequest.songId,
			title: song.title,
			artist: song.artist,
			userId: songRequest.userId,
			userName: user.name,
			stageName: singerProfile.stageName,
			note: songRequest.note,
			createdAt: songRequest.createdAt
		})
		.from(songRequest)
		.innerJoin(song, eq(songRequest.songId, song.id))
		.leftJoin(user, eq(songRequest.userId, user.id))
		.leftJoin(singerProfile, eq(singerProfile.userId, songRequest.userId))
		.where(and(eq(songRequest.status, 'pending'), isNull(songRequest.deliveredAt)))
		.orderBy(songRequest.createdAt)
		.limit(Math.min(Math.max(Math.trunc(limit), 1), 200))
		.all();

	if (rows.length === 0) return [];

	db.update(songRequest)
		.set({ deliveredAt: new Date(), updatedAt: new Date() })
		.where(
			inArray(
				songRequest.id,
				rows.map((row) => row.id)
			)
		)
		.run();

	return rows.map((row) => ({
		id: row.id,
		song: { id: row.songId, title: row.title, artist: row.artist },
		singer: { id: row.userId, name: row.userName ?? null, stageName: row.stageName ?? null },
		note: row.note,
		requestedAt: row.createdAt.toISOString()
	}));
}

/**
 * Applies a host status update. Marking a request `played` records it in the
 * singer's history exactly once.
 */
export function updateRequestStatus(
	db: AppDatabase,
	id: string,
	status: RequestStatus
): { request: SongRequest; historyRecorded: boolean } | undefined {
	const existing = getRequestById(db, id);
	if (!existing) return undefined;

	// A host status update carries the played flag too, and clears the singer's
	// pending toggle when it agrees.
	const playedForStatus = status === 'played';
	const set: {
		status: RequestStatus;
		updatedAt: Date;
		hostPlayed?: boolean;
		pendingPlayed?: boolean | null;
	} = { status, updatedAt: new Date() };

	if (status === 'approved' || status === 'playing' || status === 'played') {
		set.hostPlayed = playedForStatus;
		if (existing.pendingPlayed === playedForStatus) set.pendingPlayed = null;
	}

	const request = db.update(songRequest).set(set).where(eq(songRequest.id, id)).returning().get();

	let historyRecorded = false;
	if (status === 'played') {
		const alreadyRecorded = db
			.select()
			.from(songHistory)
			.where(eq(songHistory.requestId, id))
			.get();

		if (!alreadyRecorded) {
			recordSongHistory(db, {
				userId: existing.userId,
				songId: existing.songId,
				requestId: id
			});
			historyRecorded = true;
		}
	}

	return { request, historyRecorded };
}

/** Singer toggles the played flag; the host applies it on its next poll. */
export function setRequestedPlayed(
	db: AppDatabase,
	id: string,
	userId: string,
	played: boolean
): 'ok' | 'not-found' {
	const request = getRequestById(db, id);
	if (!request || request.userId !== userId) return 'not-found';

	db.update(songRequest)
		.set({ pendingPlayed: played, updatedAt: new Date() })
		.where(eq(songRequest.id, id))
		.run();

	return 'ok';
}

export interface QueueUpdate {
	id: string;
	played: boolean;
}

/** Played changes the singer requested, for the host to apply on its poll. */
export function pendingQueueUpdates(db: AppDatabase, limit = 200): QueueUpdate[] {
	return db
		.select({ id: songRequest.id, played: songRequest.pendingPlayed })
		.from(songRequest)
		.where(isNotNull(songRequest.pendingPlayed))
		.limit(Math.min(Math.max(Math.trunc(limit), 1), 500))
		.all()
		.map((row) => ({ id: row.id, played: row.played === true }));
}
