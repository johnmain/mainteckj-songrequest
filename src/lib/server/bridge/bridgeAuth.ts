import { error } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

/**
 * Guards host-facing endpoints with the shared bridge token. Uses a
 * constant-time comparison and requires the token to be configured.
 */
export function requireBridgeToken(request: Request): void {
	const expected = env.HOST_BRIDGE_TOKEN;
	if (!expected) {
		throw error(503, 'Host bridge is not configured');
	}

	const header = request.headers.get('authorization') ?? '';
	const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
	if (!tokensMatch(provided, expected)) {
		throw error(401, 'Unauthorized');
	}
}

function tokensMatch(provided: string, expected: string): boolean {
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}
