import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { emailConfigured, sendEmail } from '$lib/server/email';

const emailPasswordEnabled = env.AUTH_EMAIL_PASSWORD_ENABLED === 'true';
const mailer = emailConfigured();

function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(char) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char
	);
}

/**
 * Emails are fired without awaiting (see Better Auth's note on timing attacks);
 * sendEmail never throws, so nothing is left dangling.
 */
async function sendResetPasswordEmail({
	user,
	url
}: {
	user: { email: string; name: string };
	url: string;
}): Promise<void> {
	const name = escapeHtml(user.name || 'there');
	void sendEmail({
		to: user.email,
		subject: 'Reset your Maintec Karaoke password',
		text: `Hi ${user.name || 'there'},\n\nChoose a new password with this link:\n${url}\n\nThe link expires soon. If you didn't request it, you can ignore this email.`,
		html: `<p>Hi ${name},</p><p>Choose a new password for Maintec Karaoke with the link below:</p><p><a href="${url}">Reset my password</a></p><p>The link expires soon. If you didn't request it, you can ignore this email.</p>`
	});
}

async function sendVerificationEmail({
	user,
	url
}: {
	user: { email: string; name: string };
	url: string;
}): Promise<void> {
	const name = escapeHtml(user.name || 'there');
	void sendEmail({
		to: user.email,
		subject: 'Confirm your Maintec Karaoke account',
		text: `Hi ${user.name || 'there'},\n\nConfirm your email to finish creating your account:\n${url}\n\nIf you didn't sign up, you can ignore this email.`,
		html: `<p>Hi ${name},</p><p>Confirm your email to finish creating your Maintec Karaoke account:</p><p><a href="${url}">Confirm my email</a></p><p>If you didn't sign up, you can ignore this email.</p>`
	});
}

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	// A placeholder keeps the postbuild analysis pass happy; the real secret is
	// required at runtime and Better Auth will reject requests without it.
	secret:
		env.BETTER_AUTH_SECRET ?? (building ? 'build-time-secret-placeholder-0000000000' : undefined),
	database: drizzleAdapter(db, { provider: 'sqlite' }),

	// Password sign-in (enabled via env). When Resend is configured, singers
	// verify their address at sign-up and can reset a forgotten password.
	emailAndPassword: {
		enabled: emailPasswordEnabled,
		...(mailer && emailPasswordEnabled ? { requireEmailVerification: true } : {}),
		...(mailer
			? {
					revokeSessionsOnPasswordReset: true,
					sendResetPassword: sendResetPasswordEmail
				}
			: {})
	},

	// Verification emails are only wired up when a mailer exists, so local
	// builds and CI work without secrets.
	...(mailer
		? {
				emailVerification: {
					sendVerificationEmail,
					sendOnSignUp: true,
					autoSignInAfterVerification: true
				}
			}
		: {}),

	// Google is the one social provider; it is registered only when its
	// credentials are present so local builds and CI work without secrets.
	socialProviders: {
		...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET
					}
				}
			: {})
	},

	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	],

	advanced: {
		// The portal runs behind the Netbird reverse proxy, which forwards the
		// real client address via these headers (used for rate limiting).
		ipAddress: {
			ipAddressHeaders: ['x-forwarded-for', 'x-real-ip']
		}
	}
});

export type Auth = typeof auth;
