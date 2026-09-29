import { eq } from 'drizzle-orm';
import { song, type SongRequest } from '../db/schema';
import type { AppDatabase } from '../db/client';
import { createSongRequest, findPendingRequest } from './requests';

export interface SubmitSongRequestInput {
	user: { id: string; name?: string | null };
	songId: string;
	note?: string | null;
}

export type SubmitSongRequestResult =
	{ ok: true; request: SongRequest; duplicate: boolean } | { ok: false; reason: 'song-not-found' };

/**
 * Queues a singer's request. Under the pull model the portal just stores it
 * pending; the desktop host claims it on its next poll. Delivery is therefore
 * not part of this call.
 */
export function submitSongRequest(
	db: AppDatabase,
	input: SubmitSongRequestInput
): SubmitSongRequestResult {
	const track = db.select().from(song).where(eq(song.id, input.songId)).get();
	if (!track) return { ok: false, reason: 'song-not-found' };

	const existing = findPendingRequest(db, input.user.id, input.songId);
	if (existing) return { ok: true, request: existing, duplicate: true };

	const note = input.note?.trim() ? input.note.trim() : null;
	const request = createSongRequest(db, {
		userId: input.user.id,
		songId: input.songId,
		note
	});

	return { ok: true, request, duplicate: false };
}
