import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { listSongs, searchSongs, type SongSort } from '$lib/server/catalog/search';
import { submitSongRequest } from '$lib/server/requests/submitRequest';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 20;
const SORTS: SongSort[] = ['relevance', 'artist', 'title'];

function resolveSort(raw: string | null, hasQuery: boolean): SongSort {
	if (SORTS.includes(raw as SongSort)) return raw as SongSort;
	return hasQuery ? 'relevance' : 'artist';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}

	const query = url.searchParams.get('q')?.trim() ?? '';
	const requested = Number(url.searchParams.get('page') ?? '1');
	const page = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 1;
	const sort = resolveSort(url.searchParams.get('sort'), query.length > 0);
	const options = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, sort };

	const results = query
		? searchSongs(db, query, options)
		: listSongs(db, { ...options, sort: sort === 'title' ? 'title' : 'artist' });

	return {
		query,
		sort,
		results,
		page,
		hasMore: results.length === PAGE_SIZE
	};
};

export const actions: Actions = {
	request: async (event) => {
		if (!event.locals.user) {
			return redirect(302, '/login');
		}

		const formData = await event.request.formData();
		const songId = formData.get('songId')?.toString() ?? '';
		const note = formData.get('note')?.toString() ?? null;

		const result = submitSongRequest(db, { user: event.locals.user, songId, note });

		if (!result.ok) {
			return fail(404, { message: 'That song is no longer in the catalog.' });
		}
		if (result.duplicate) {
			return redirect(303, '/requests?new=duplicate');
		}

		return redirect(303, '/requests?new=sent');
	}
};
