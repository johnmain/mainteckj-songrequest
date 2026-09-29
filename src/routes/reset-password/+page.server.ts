import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const token = url.searchParams.get('token');
	const error = url.searchParams.get('error');
	return { token, invalid: !token || Boolean(error) };
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const token = formData.get('token')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const confirm = formData.get('confirm')?.toString() ?? '';

		if (!token) {
			return fail(400, { message: 'This reset link is invalid or has expired.' });
		}
		if (password.length < 8) {
			return fail(400, { message: 'Password must be at least 8 characters.' });
		}
		if (password !== confirm) {
			return fail(400, { message: 'The passwords do not match.' });
		}

		try {
			await auth.api.resetPassword({ body: { newPassword: password, token } });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Could not reset the password.' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		return redirect(302, '/login?reset=1');
	}
};
