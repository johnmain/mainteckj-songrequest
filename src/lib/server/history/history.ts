import { count, desc, eq } from 'drizzle-orm';
import { song, songHistory, type SongHistory } from '../db/schema';
import type { AppDatabase } from '../db/client';

export interface HistoryEntry {
	id: string;
	songId: string;
	title: string;
	artist: string;
	sungAt: Date;
	requestId: string | null;
}

export interface HistoryOptions {
	limit?: number;
	offset?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function clampLimit(limit: number | undefined): number {
	return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
}

/** A singer's performed songs, newest first, joined with song details. */
export function listSongHistory(
	db: AppDatabase,
	userId: string,
	options: HistoryOptions = {}
): HistoryEntry[] {
	return db
		.select({
			id: songHistory.id,
			songId: songHistory.songId,
			title: song.title,
			artist: song.artist,
			sungAt: songHistory.sungAt,
			requestId: songHistory.requestId
		})
		.from(songHistory)
		.innerJoin(song, eq(songHistory.songId, song.id))
		.where(eq(songHistory.userId, userId))
		.orderBy(desc(songHistory.sungAt))
		.limit(clampLimit(options.limit))
		.offset(Math.max(Math.trunc(options.offset ?? 0), 0))
		.all();
}

export function countSongHistory(db: AppDatabase, userId: string): number {
	return (
		db.select({ value: count() }).from(songHistory).where(eq(songHistory.userId, userId)).get()
			?.value ?? 0
	);
}

/** Records a performed song. Called when the host marks a request played. */
export function recordSongHistory(
	db: AppDatabase,
	entry: {
		userId: string;
		songId: string;
		requestId?: string | null;
		sungAt?: Date;
	}
): SongHistory {
	return db
		.insert(songHistory)
		.values({
			userId: entry.userId,
			songId: entry.songId,
			requestId: entry.requestId ?? null,
			sungAt: entry.sungAt ?? new Date()
		})
		.returning()
		.get();
}
