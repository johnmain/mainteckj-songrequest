import { and, eq, inArray } from 'drizzle-orm';
import { song, songRequest } from '../db/schema';
import type { AppDatabase } from '../db/client';
import { normalizeText } from '../catalog/normalize';
import { resolveSingerByName, type HostSinger } from './singers';

/** A song from the desktop queue, as sent by the host. */
export interface QueueSongInput {
	title?: string;
	artist?: string;
	played?: boolean;
}

export interface PushQueueInput {
	singerName: string;
	songs: QueueSongInput[];
	/** When true, only compute the changes; write nothing. */
	dryRun?: boolean;
}

export type PushQueueResult =
	| { status: 'unknown-singer' }
	| { status: 'ambiguous'; candidates: HostSinger[] }
	| {
			status: 'ok';
			dryRun: boolean;
			singer: HostSinger;
			received: number;
			created: number;
			updated: number;
			removed: number;
			skipped: number;
			/** The request each queued song maps to; empty on a dry run. */
			requests: { title: string; artist: string; requestId: string | null }[];
	  };

/** Requests that are still "in play"; played/rejected are left alone. */
const ACTIVE_STATUSES = ['pending', 'approved', 'playing'] as const;

interface PlannedSong {
	title: string;
	artist: string;
	normalizedTitle: string;
	normalizedArtist: string;
	played: boolean;
	/** Existing catalog row, or null if the push has to create it. */
	songId: string | null;
	/** Existing active request for this song, if any. */
	activeRequestId: string | null;
}

interface Plan {
	planned: PlannedSong[];
	created: number;
	updated: number;
	removedIds: string[];
	skipped: number;
}

/** Works out what a push would do, reading only. */
function buildPlan(db: AppDatabase, singerId: string, songs: QueueSongInput[]): Plan {
	const planned: PlannedSong[] = [];
	let skipped = 0;

	for (const item of songs) {
		const title = item.title?.trim() ?? '';
		const artist = item.artist?.trim() ?? '';
		const normalizedTitle = normalizeText(title);
		const normalizedArtist = normalizeText(artist);

		if (!normalizedTitle || !normalizedArtist) {
			skipped++;
			continue;
		}

		const played = item.played === true;
		const already = planned.find(
			(p) => p.normalizedTitle === normalizedTitle && p.normalizedArtist === normalizedArtist
		);
		if (already) {
			already.played = played; // last occurrence wins
			continue;
		}

		const existing = db
			.select({ id: song.id })
			.from(song)
			.where(
				and(eq(song.normalizedTitle, normalizedTitle), eq(song.normalizedArtist, normalizedArtist))
			)
			.get();

		planned.push({
			title,
			artist,
			normalizedTitle,
			normalizedArtist,
			played,
			songId: existing?.id ?? null,
			activeRequestId: null
		});
	}

	const active = db
		.select()
		.from(songRequest)
		.where(and(eq(songRequest.userId, singerId), inArray(songRequest.status, ACTIVE_STATUSES)))
		.all();
	const bySong = new Map(active.map((request) => [request.songId, request]));

	let created = 0;
	let updated = 0;
	for (const item of planned) {
		const match = item.songId ? bySong.get(item.songId) : undefined;
		if (match) {
			item.activeRequestId = match.id;
			updated++;
		} else {
			created++;
		}
	}

	const wantedSongIds = new Set(planned.map((item) => item.songId).filter(Boolean) as string[]);
	const removedIds = active
		.filter((request) => !wantedSongIds.has(request.songId))
		.map((r) => r.id);

	return { planned, created, updated, removedIds, skipped };
}

/**
 * Full reconcile of one singer's active requests against the desktop queue:
 * songs present in the queue are created/updated (they are already in the host
 * queue, so they are marked approved + delivered), and active requests whose
 * song is no longer queued are removed. Played/rejected rows are never touched.
 *
 * With `dryRun`, the same plan is computed but nothing is written.
 */
export function pushSingerQueue(db: AppDatabase, input: PushQueueInput): PushQueueResult {
	const resolved = resolveSingerByName(db, input.singerName);
	if (resolved.status === 'unknown') return { status: 'unknown-singer' };
	if (resolved.status === 'ambiguous') return resolved;

	const { singer } = resolved;
	const songs = Array.isArray(input.songs) ? input.songs : [];
	const dryRun = input.dryRun === true;
	const plan = buildPlan(db, singer.id, songs);

	const requests: { title: string; artist: string; requestId: string | null }[] = [];

	if (!dryRun) {
		db.transaction((tx) => {
			if (plan.removedIds.length > 0) {
				tx.delete(songRequest).where(inArray(songRequest.id, plan.removedIds)).run();
			}

			const now = new Date();
			for (const item of plan.planned) {
				let songId = item.songId;
				if (!songId) {
					songId = tx
						.insert(song)
						.values({
							title: item.title,
							artist: item.artist,
							normalizedTitle: item.normalizedTitle,
							normalizedArtist: item.normalizedArtist
						})
						.returning()
						.get().id;
				}

				if (item.activeRequestId) {
					tx.update(songRequest)
						.set({
							status: 'approved',
							hostPlayed: item.played,
							deliveredAt: now,
							updatedAt: now
						})
						.where(eq(songRequest.id, item.activeRequestId))
						.run();
					requests.push({
						title: item.title,
						artist: item.artist,
						requestId: item.activeRequestId
					});
				} else {
					const created = tx
						.insert(songRequest)
						.values({
							userId: singer.id,
							songId,
							status: 'approved',
							hostPlayed: item.played,
							deliveredAt: now
						})
						.returning()
						.get();
					requests.push({ title: item.title, artist: item.artist, requestId: created.id });
				}
			}
		});
	}

	return {
		status: 'ok',
		dryRun,
		singer,
		received: songs.length,
		created: plan.created,
		updated: plan.updated,
		removed: plan.removedIds.length,
		skipped: plan.skipped,
		requests
	};
}
