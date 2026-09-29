import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { requireBridgeToken } from '$lib/server/bridge/bridgeAuth';
import { claimPendingRequests, pendingQueueUpdates } from '$lib/server/requests/requests';
import type { RequestHandler } from './$types';

/**
 * Pull model: the desktop host polls this on a timer to claim new singer
 * requests and to pick up singer-requested played/unplayed toggles. Claimed
 * requests are marked delivered so the next poll won't return them again.
 * Protected by the shared HOST_BRIDGE_TOKEN.
 */
export const POST: RequestHandler = ({ request }) => {
	requireBridgeToken(request);

	const requests = claimPendingRequests(db);
	const updates = pendingQueueUpdates(db);

	return json({ count: requests.length, requests, updates });
};
