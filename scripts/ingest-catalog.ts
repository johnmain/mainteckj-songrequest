import { readFile } from 'node:fs/promises';
import { createDb } from '../src/lib/server/db/client';
import { parseCatalogExport } from '../src/lib/server/catalog/parse';
import { ingestCatalog } from '../src/lib/server/catalog/ingest';

// Allow running from the repo root with a local .env file.
try {
	process.loadEnvFile('.env');
} catch {
	// No .env file — rely on the ambient environment.
}

const file = process.argv[2];
if (!file) {
	console.error('Usage: npm run catalog:ingest -- <path-to-export.(json|csv)>');
	process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

const contents = await readFile(file, 'utf8');
const rows = parseCatalogExport(contents);
const summary = ingestCatalog(createDb(databaseUrl), rows);

console.log(JSON.stringify(summary, null, 2));
