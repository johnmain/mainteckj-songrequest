import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { countSongHistory, listSongHistory } from '$lib/server/history/history';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 20;

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}

	const requested = Number(url.searchParams.get('page') ?? '1');
	const page = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 1;
	const total = countSongHistory(db, locals.user.id);

	return {
		entries: listSongHistory(db, locals.user.id, {
			limit: PAGE_SIZE,
			offset: (page - 1) * PAGE_SIZE
		}),
		total,
		page,
		pageSize: PAGE_SIZE,
		totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE))
	};
};
