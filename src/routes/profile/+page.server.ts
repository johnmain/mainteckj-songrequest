import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import {
	getProfile,
	sanitizeProfileInput,
	upsertProfile,
	validateProfileInput
} from '$lib/server/profile/profile';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}

	return {
		user: locals.user,
		profile: getProfile(db, locals.user.id) ?? null
	};
};

export const actions: Actions = {
	updateProfile: async (event) => {
		if (!event.locals.user) {
			return redirect(302, '/login');
		}

		const formData = await event.request.formData();
		const values = {
			stageName: formData.get('stageName')?.toString() ?? '',
			phone: formData.get('phone')?.toString() ?? '',
			bio: formData.get('bio')?.toString() ?? ''
		};

		const input = sanitizeProfileInput(values);
		const errors = validateProfileInput(input);
		if (errors.length > 0) {
			return fail(400, { success: false, message: errors[0], values });
		}

		upsertProfile(db, event.locals.user.id, input);
		return { success: true, message: 'Profile saved.', values };
	},

	signOut: async (event) => {
		await auth.api.signOut({ headers: event.request.headers });
		return redirect(302, '/');
	}
};
