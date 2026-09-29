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
}

export type PushQueueResult =
	| { status: 'unknown-singer' }
	| { status: 'ambiguous'; candidates: HostSinger[] }
	| {
			status: 'ok';
			singer: HostSinger;
			received: number;
			created: number;
			updated: number;
			removed: number;
			skipped: number;
	  };

/** Requests that are still "in play"; played/rejected are left alone. */
const ACTIVE_STATUSES = ['pending', 'approved', 'playing'] as const;

/**
 * Full reconcile of one singer's active requests against the desktop queue:
 * songs present in the queue are created/updated (they are already in the host
 * queue, so they are marked approved + delivered), and active requests whose
 * song is no longer queued are removed. Played/rejected rows are never touched.
 */
export function pushSingerQueue(db: AppDatabase, input: PushQueueInput): PushQueueResult {
	const resolved = resolveSingerByName(db, input.singerName);
	if (resolved.status === 'unknown') return { status: 'unknown-singer' };
	if (resolved.status === 'ambiguous') return resolved;

	const { singer } = resolved;
	const songs = Array.isArray(input.songs) ? input.songs : [];

	let skipped = 0;
	/** songId -> played, last occurrence wins. */
	const wanted = new Map<string, boolean>();

	for (const item of songs) {
		const title = item.title?.trim() ?? '';
		const artist = item.artist?.trim() ?? '';
		const normalizedTitle = normalizeText(title);
		const normalizedArtist = normalizeText(artist);

		if (!normalizedTitle || !normalizedArtist) {
			skipped++;
			continue;
		}

		const existing = db
			.select({ id: song.id })
			.from(song)
			.where(
				and(eq(song.normalizedTitle, normalizedTitle), eq(song.normalizedArtist, normalizedArtist))
			)
			.get();

		const songId =
			existing?.id ??
			db.insert(song).values({ title, artist, normalizedTitle, normalizedArtist }).returning().get()
				.id;

		wanted.set(songId, item.played === true);
	}

	let created = 0;
	let updated = 0;
	let removed = 0;

	db.transaction((tx) => {
		const active = tx
			.select()
			.from(songRequest)
			.where(and(eq(songRequest.userId, singer.id), inArray(songRequest.status, ACTIVE_STATUSES)))
			.all();

		const toRemove = active.filter((request) => !wanted.has(request.songId)).map((r) => r.id);
		if (toRemove.length > 0) {
			tx.delete(songRequest).where(inArray(songRequest.id, toRemove)).run();
			removed = toRemove.length;
		}

		const bySong = new Map(active.map((request) => [request.songId, request]));
		const now = new Date();

		for (const [songId, played] of wanted) {
			const existing = bySong.get(songId);

			if (existing) {
				tx.update(songRequest)
					.set({
						status: existing.status === 'pending' ? 'approved' : existing.status,
						hostPlayed: played,
						deliveredAt: existing.deliveredAt ?? now,
						updatedAt: now
					})
					.where(eq(songRequest.id, existing.id))
					.run();
				updated++;
			} else {
				tx.insert(songRequest)
					.values({
						userId: singer.id,
						songId,
						status: 'approved',
						hostPlayed: played,
						deliveredAt: now
					})
					.run();
				created++;
			}
		}
	});

	return {
		status: 'ok',
		singer,
		received: songs.length,
		created,
		updated,
		removed,
		skipped
	};
}
