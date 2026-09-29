import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { emailConfigured } from '$lib/server/email';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) {
		return redirect(302, '/songs');
	}

	const emailPassword = env.AUTH_EMAIL_PASSWORD_ENABLED === 'true';
	const mailer = emailConfigured();

	return {
		providers: {
			google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
			emailPassword
		},
		passwordReset: emailPassword && mailer,
		verification: emailPassword && mailer,
		reset: url.searchParams.get('reset') === '1',
		verified: url.searchParams.get('verified') === '1'
	};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			await auth.api.signInEmail({ body: { email, password } });
		} catch (error) {
			if (error instanceof APIError) {
				if (error.status === 403) {
					return fail(400, {
						unverified: true,
						email,
						message: 'Confirm your email address before signing in.'
					});
				}
				return fail(400, { message: error.message || 'Sign in failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		return redirect(302, '/songs');
	},

	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString().trim() ?? '';

		let result: { token?: string | null } | null;
		try {
			result = await auth.api.signUpEmail({
				body: { email, password, name, callbackURL: '/songs' }
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		// When email verification is required, sign-up creates the account but
		// returns no session — ask the singer to confirm their inbox. Otherwise
		// they are signed straight in.
		if (!result?.token) {
			return { verifySent: true, email };
		}

		return redirect(302, '/songs');
	},

	resendVerification: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';

		if (!email) {
			return fail(400, { message: 'Enter your email address.' });
		}

		try {
			await auth.api.sendVerificationEmail({ body: { email, callbackURL: '/songs' } });
		} catch (error) {
			if (!(error instanceof APIError)) {
				return fail(500, { message: 'Unexpected error' });
			}
			// Swallowed: never reveal whether the address is registered.
		}

		return { verifySent: true, email };
	}
};
