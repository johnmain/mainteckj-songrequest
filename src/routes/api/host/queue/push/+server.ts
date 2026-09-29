import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { requireBridgeToken } from '$lib/server/bridge/bridgeAuth';
import { pushSingerQueue, type QueueSongInput } from '$lib/server/requests/pushQueue';
import type { RequestHandler } from './$types';

/**
 * Host pushes one singer's queue so the Request DB matches the desktop queue:
 * queued songs become approved requests, and active requests no longer in the
 * queue are removed. Protected by HOST_BRIDGE_TOKEN.
 *
 * Body: { "singerName": "Alice", "songs": [{ "title": "...", "artist": "...", "played": false }] }
 */
export const POST: RequestHandler = async ({ request }) => {
	requireBridgeToken(request);

	const body = (await request.json().catch(() => null)) as {
		singerName?: unknown;
		songs?: unknown;
	} | null;

	if (!body || typeof body !== 'object') {
		throw error(400, 'Expected a JSON body');
	}

	const singerName = typeof body.singerName === 'string' ? body.singerName : '';
	if (!singerName.trim()) {
		throw error(400, 'singerName is required');
	}

	const songs = Array.isArray(body.songs) ? (body.songs as QueueSongInput[]) : [];

	const result = pushSingerQueue(db, { singerName, songs });

	if (result.status === 'unknown-singer') {
		throw error(404, `No portal singer named "${singerName}" — they must sign in once`);
	}
	if (result.status === 'ambiguous') {
		const names = result.candidates.map((c) => c.name).join(', ');
		throw error(409, `"${singerName}" matches multiple portal singers: ${names}`);
	}

	return json(result);
};
