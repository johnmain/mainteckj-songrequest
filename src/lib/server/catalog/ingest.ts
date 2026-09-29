import { song, type NewSong } from '../db/schema';
import type { AppDatabase } from '../db/client';
import { normalizeText } from './normalize';
import type { CatalogInputRow } from './parse';

export interface IngestSummary {
	/** Rows handed to the ingester. */
	received: number;
	/** Rows that produced an insert or update. */
	imported: number;
	/** Newly created songs. */
	created: number;
	/** Existing songs refreshed from the export. */
	updated: number;
	/** Rows ignored because title or artist was empty. */
	skipped: number;
}

const UPSERT_CHUNK_SIZE = 200;
/** Only narrate progress for large imports (the desktop catalog sync). */
const LOG_THRESHOLD = 2_000;
const PROGRESS_EVERY = 10_000;

/**
 * Upserts a de-duplicated master catalog. Songs are matched on the
 * normalized title + artist key, so re-importing the export refreshes
 * display casing instead of creating duplicates.
 */
export function ingestCatalog(db: AppDatabase, rows: CatalogInputRow[]): IngestSummary {
	const existing = new Set(
		db
			.select({ title: song.normalizedTitle, artist: song.normalizedArtist })
			.from(song)
			.all()
			.map((row) => `${row.title}|${row.artist}`)
	);

	const pending: NewSong[] = [];
	let created = 0;
	let updated = 0;
	let skipped = 0;

	for (const row of rows) {
		const title = row.title.trim();
		const artist = row.artist.trim();
		const normalizedTitle = normalizeText(title);
		const normalizedArtist = normalizeText(artist);

		if (!normalizedTitle || !normalizedArtist) {
			skipped++;
			continue;
		}

		const key = `${normalizedTitle}|${normalizedArtist}`;
		if (existing.has(key)) {
			updated++;
		} else {
			created++;
			existing.add(key);
		}

		pending.push({ title, artist, normalizedTitle, normalizedArtist });
	}

	const verbose = pending.length > LOG_THRESHOLD;
	if (verbose) {
		console.log(
			`[catalog] ingesting ${pending.length} songs (${created} new, ${updated} refreshed, ${skipped} skipped)`
		);
	}

	for (let i = 0; i < pending.length; i += UPSERT_CHUNK_SIZE) {
		const chunk = pending.slice(i, i + UPSERT_CHUNK_SIZE);
		db.transaction((tx) => {
			for (const values of chunk) {
				tx.insert(song)
					.values(values)
					.onConflictDoUpdate({
						target: [song.normalizedTitle, song.normalizedArtist],
						set: {
							title: values.title,
							artist: values.artist,
							updatedAt: new Date()
						}
					})
					.run();
			}
		});

		const committed = i + chunk.length;
		if (verbose && (committed % PROGRESS_EVERY === 0 || committed === pending.length)) {
			console.log(`[catalog] committed ${committed}/${pending.length}`);
		}
	}

	if (verbose) {
		console.log(`[catalog] done: ${created} created, ${updated} updated, ${skipped} skipped`);
	}

	return { received: rows.length, imported: pending.length, created, updated, skipped };
}
