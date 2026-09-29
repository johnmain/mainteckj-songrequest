import process from 'node:process';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('[migrate] DATABASE_URL is not set');
	process.exit(1);
}

migrate(drizzle(new Database(url)), { migrationsFolder: './drizzle' });
console.log('[migrate] migrations applied');
