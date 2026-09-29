import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { searchSongs, type SongSort } from '$lib/server/catalog/search';
import type { RequestHandler } from './$types';

const SORTS: SongSort[] = ['relevance', 'artist', 'title'];

function toInt(value: string | null, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function toSort(value: string | null): SongSort {
	return SORTS.includes(value as SongSort) ? (value as SongSort) : 'relevance';
}

/** Fast fuzzy catalog search for mobile browsing. */
export const GET: RequestHandler = ({ url }) => {
	const query = url.searchParams.get('q') ?? '';
	const results = searchSongs(db, query, {
		limit: toInt(url.searchParams.get('limit'), 20),
		offset: toInt(url.searchParams.get('offset'), 0),
		sort: toSort(url.searchParams.get('sort'))
	});

	return json({ query, count: results.length, results });
};
