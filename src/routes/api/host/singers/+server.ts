import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { requireBridgeToken } from '$lib/server/bridge/bridgeAuth';
import { listHostSingers } from '$lib/server/requests/singers';
import type { RequestHandler } from './$types';

/**
 * Host-facing directory of portal accounts, so the desktop app can show which
 * of its singers exist in the Request DB. Protected by HOST_BRIDGE_TOKEN.
 */
export const GET: RequestHandler = ({ request }) => {
	requireBridgeToken(request);
	return json({ singers: listHostSingers(db) });
};
