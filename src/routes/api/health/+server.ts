import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Public liveness probe used by the desktop host's "Test" button. */
export const GET: RequestHandler = () => json({ ok: true });
