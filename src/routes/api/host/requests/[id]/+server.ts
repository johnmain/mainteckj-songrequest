import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { requireBridgeToken } from '$lib/server/bridge/bridgeAuth';
import {
	REQUEST_STATUSES,
	updateRequestStatus,
	type RequestStatus
} from '$lib/server/requests/requests';
import type { RequestHandler } from './$types';

/**
 * Host callback: reports a request's progress. Marking a request `played`
 * records it in the singer's history.
 */
export const PATCH: RequestHandler = async ({ request, params }) => {
	requireBridgeToken(request);

	const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
	const status = body?.status;
	if (typeof status !== 'string' || !REQUEST_STATUSES.includes(status as RequestStatus)) {
		throw error(400, `status must be one of: ${REQUEST_STATUSES.join(', ')}`);
	}

	const result = updateRequestStatus(db, params.id, status as RequestStatus);
	if (!result) {
		throw error(404, 'Request not found');
	}

	return json({ request: result.request, historyRecorded: result.historyRecorded });
};
