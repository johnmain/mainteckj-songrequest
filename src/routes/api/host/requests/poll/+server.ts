import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { requireBridgeToken } from '$lib/server/bridge/bridgeAuth';
import { recordHostHeartbeat } from '$lib/server/requests/hostState';
import { claimPendingRequests, pendingQueueUpdates } from '$lib/server/requests/requests';
import type { RequestHandler } from './$types';

/**
 * Pull model: the desktop host polls this on a timer to claim new singer
 * requests and to pick up singer-requested played/unplayed toggles. Claimed
 * requests are marked delivered so the next poll won't return them again.
 * Protected by the shared HOST_BRIDGE_TOKEN.
 *
 * The poll is also the host's heartbeat: `X-Accepting` (optional) carries the
 * app's "accepting requests" toggle, feeding the public /api/status endpoint.
 */
export const POST: RequestHandler = ({ request }) => {
	requireBridgeToken(request);

	const acceptingHeader = request.headers.get('x-accepting');
	const accepting =
		acceptingHeader === null ? null : acceptingHeader === 'true' || acceptingHeader === '1';
	recordHostHeartbeat(db, accepting);

	const requests = claimPendingRequests(db);
	const updates = pendingQueueUpdates(db);

	return json({ count: requests.length, requests, updates });
};
