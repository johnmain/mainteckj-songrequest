import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { requireBridgeToken } from '$lib/server/bridge/bridgeAuth';
import { ingestCatalog } from '$lib/server/catalog/ingest';
import { parseCatalogExport } from '$lib/server/catalog/parse';
import type { RequestHandler } from './$types';

/**
 * Accepts the desktop app's distinct master song export (title + artist).
 * Protected by the shared HOST_BRIDGE_TOKEN so only the host can push it.
 */
export const POST: RequestHandler = async ({ request }) => {
	requireBridgeToken(request);

	const contentType = request.headers.get('content-type') ?? '';
	const body = await request.text();

	let rows;
	try {
		rows = parseCatalogExport(body, contentType.includes('json') ? 'json' : 'auto');
	} catch (cause) {
		throw error(400, cause instanceof Error ? cause.message : 'Invalid catalog export');
	}

	return json(ingestCatalog(db, rows));
};
