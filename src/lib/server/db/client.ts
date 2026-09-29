import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

/**
 * Creates a Drizzle SQLite client. Kept free of `$env` imports so tests and
 * scripts can build their own connection (in-memory or file based).
 */
export function createDb(url: string) {
	const client = new Database(url);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');
	return drizzle(client, { schema });
}

export type AppDatabase = ReturnType<typeof createDb>;
