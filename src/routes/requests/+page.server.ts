import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	countUserRequests,
	deleteSongRequest,
	listUserRequests,
	setRequestedPlayed
} from '$lib/server/requests/requests';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 20;

interface RequestNotice {
	tone: 'success' | 'warning';
	message: string;
}

/** Turns the `?new=…` flag from the request flow into a displayable notice. */
function buildNotice(params: URLSearchParams): RequestNotice | null {
	const kind = params.get('new');

	if (kind === 'sent') {
		return { tone: 'success', message: 'Request added to the KJ queue.' };
	}
	if (kind === 'duplicate') {
		return { tone: 'warning', message: 'That song is already in your requests.' };
	}

	return null;
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}

	const requested = Number(url.searchParams.get('page') ?? '1');
	const page = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 1;
	const total = countUserRequests(db, locals.user.id);

	return {
		requests: listUserRequests(db, locals.user.id, {
			limit: PAGE_SIZE,
			offset: (page - 1) * PAGE_SIZE
		}),
		total,
		page,
		pageSize: PAGE_SIZE,
		totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		notice: buildNotice(url.searchParams)
	};
};

export const actions: Actions = {
	togglePlayed: async (event) => {
		if (!event.locals.user) {
			return redirect(302, '/login');
		}

		const formData = await event.request.formData();
		const id = formData.get('id')?.toString() ?? '';
		const played = formData.get('played')?.toString() === 'true';

		const result = setRequestedPlayed(db, id, event.locals.user.id, played);
		if (result === 'not-found') {
			return fail(404, { success: false, message: 'That request could not be found.' });
		}

		return {
			success: true,
			message: played
				? 'Marked played — the KJ will apply it shortly.'
				: 'Marked unplayed — the KJ will apply it shortly.'
		};
	},

	delete: async (event) => {
		if (!event.locals.user) {
			return redirect(302, '/login');
		}

		const formData = await event.request.formData();
		const id = formData.get('id')?.toString() ?? '';
		const result = deleteSongRequest(db, id, event.locals.user.id);

		if (result === 'not-found') {
			return fail(404, { success: false, message: 'That request could not be found.' });
		}
		if (result === 'not-deletable') {
			return fail(400, { success: false, message: 'This song can no longer be removed.' });
		}
		if (result === 'pending-removal') {
			return {
				success: true,
				message: 'Removed — the KJ will drop it from the queue shortly.'
			};
		}

		return { success: true, message: 'Request removed.' };
	}
};
