import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getHostStatus } from '$lib/server/requests/hostState';
import type { RequestHandler } from './$types';

/**
 * Public, CORS-enabled status the marketing site polls to decide whether to
 * show the "request your songs live" link. `accepting` is true only while the
 * desktop host is live and its toggle is on.
 */
export const GET: RequestHandler = () => {
	const status = getHostStatus(db);
	return json(
		{
			accepting: status.accepting,
			hostSeenAt: status.hostSeenAt,
			updatedAt: status.updatedAt
		},
		{
			headers: {
				'access-control-allow-origin': '*',
				'cache-control': 'no-store'
			}
		}
	);
};
