import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createDb } from './client';

// SvelteKit imports server modules during the postbuild analysis pass, before
// runtime environment variables exist. Fall back to an in-memory database for
// that pass only; a real DATABASE_URL is still required to run the app.
const url = env.DATABASE_URL ?? (building ? ':memory:' : undefined);
if (!url) throw new Error('DATABASE_URL is not set');

export const db = createDb(url);
