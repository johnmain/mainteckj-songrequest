import { fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { emailConfigured } from '$lib/server/email';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	available: env.AUTH_EMAIL_PASSWORD_ENABLED === 'true' && emailConfigured()
});

export const actions: Actions = {
	default: async (event) => {
		if (env.AUTH_EMAIL_PASSWORD_ENABLED !== 'true' || !emailConfigured()) {
			return fail(400, { message: 'Password reset is not available.' });
		}

		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';

		if (!email) {
			return fail(400, { message: 'Enter your email address.' });
		}

		try {
			await auth.api.requestPasswordReset({
				body: { email, redirectTo: `${event.url.origin}/reset-password` }
			});
		} catch (error) {
			if (!(error instanceof APIError)) {
				return fail(500, { message: 'Unexpected error' });
			}
			// Swallowed on purpose: never reveal whether the address is registered.
		}

		return { sent: true };
	}
};
