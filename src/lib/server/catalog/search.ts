import { eq, inArray, like, or, sql } from 'drizzle-orm';
import { song, type Song } from '../db/schema';
import type { AppDatabase } from '../db/client';
import { buildFtsQuery, normalizeText } from './normalize';
import { FUZZY_MIN_SCORE, rankSongs } from './fuzzy';

export type SongSort = 'relevance' | 'artist' | 'title';

export interface SearchOptions {
	limit?: number;
	offset?: number;
	sort?: SongSort;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CANDIDATE_LIMIT = 300;
const MAX_TOKENS = 8;

function clampLimit(limit: number | undefined): number {
	return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
}

function clampOffset(offset: number | undefined): number {
	return Math.max(Math.trunc(offset ?? 0), 0);
}

/** Alphabetical comparison used for the non-relevance sort orders. */
function compareSongs(a: Song, b: Song, sort: SongSort): number {
	if (sort === 'title') {
		return (
			a.normalizedTitle.localeCompare(b.normalizedTitle) ||
			a.normalizedArtist.localeCompare(b.normalizedArtist)
		);
	}
	return (
		a.normalizedArtist.localeCompare(b.normalizedArtist) ||
		a.normalizedTitle.localeCompare(b.normalizedTitle)
	);
}

/**
 * Fuzzy catalog search. Candidates are gathered quickly (FTS5 prefix + indexed
 * substring matches), then ranked by character-bigram similarity so typos and
 * word variations still match. If nothing scores well, the whole catalog is
 * ranked as a typo-tolerant fallback.
 */
export function searchSongs(db: AppDatabase, query: string, options: SearchOptions = {}): Song[] {
	const normalized = normalizeText(query);
	if (!normalized) return [];

	const limit = clampLimit(options.limit);
	const offset = clampOffset(options.offset);
	const sort = options.sort ?? 'relevance';

	let ranked = rankSongs(normalized, collectCandidates(db, query, normalized));

	if ((ranked[0]?.score ?? 0) < FUZZY_MIN_SCORE && normalized.replace(/\s+/g, '').length >= 3) {
		ranked = rankSongs(normalized, db.select().from(song).all());
	}

	const matches = ranked.filter((entry) => entry.score >= FUZZY_MIN_SCORE);
	const ordered =
		sort === 'relevance'
			? matches
			: [...matches].sort((a, b) => compareSongs(a.song, b.song, sort));

	return ordered.slice(offset, offset + limit).map((entry) => entry.song);
}

export function getSongById(db: AppDatabase, id: string): Song | undefined {
	return db.select().from(song).where(eq(song.id, id)).get();
}

/** Alphabetical listing used for browsing the catalog without a query. */
export function listSongs(db: AppDatabase, options: SearchOptions = {}): Song[] {
	const sort = options.sort === 'title' ? 'title' : 'artist';
	const direction =
		sort === 'title'
			? [song.normalizedTitle, song.normalizedArtist]
			: [song.normalizedArtist, song.normalizedTitle];

	return db
		.select()
		.from(song)
		.orderBy(...direction)
		.limit(clampLimit(options.limit))
		.offset(clampOffset(options.offset))
		.all();
}

/** FTS5 prefix matches plus indexed substring matches, de-duplicated by id. */
function collectCandidates(db: AppDatabase, query: string, normalized: string): Song[] {
	const found = new Map<string, Song>();

	const match = buildFtsQuery(query);
	if (match) {
		try {
			const ids = db
				.all<{ id: string }>(
					sql`
					SELECT f.song_id AS id
					FROM song_fts f
					WHERE song_fts MATCH ${match}
					ORDER BY bm25(song_fts)
					LIMIT ${CANDIDATE_LIMIT}
				`
				)
				.map((row) => row.id);
			for (const entity of hydrate(db, ids)) found.set(entity.id, entity);
		} catch {
			// FTS unavailable — the LIKE query below still covers searching.
		}
	}

	const tokens = normalized.split(' ').filter(Boolean).slice(0, MAX_TOKENS);
	if (tokens.length > 0) {
		const conditions = tokens.flatMap((token) => {
			const pattern = `%${token}%`;
			return [like(song.normalizedTitle, pattern), like(song.normalizedArtist, pattern)];
		});

		const rows = db
			.select()
			.from(song)
			.where(or(...conditions))
			.limit(CANDIDATE_LIMIT)
			.all();
		for (const entity of rows) found.set(entity.id, entity);
	}

	return [...found.values()];
}

function hydrate(db: AppDatabase, ids: string[]): Song[] {
	if (ids.length === 0) return [];
	return db.select().from(song).where(inArray(song.id, ids)).all();
}
