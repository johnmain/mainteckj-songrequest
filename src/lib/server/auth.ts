import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { emailConfigured, sendEmail } from '$lib/server/email';

function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(char) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char
	);
}

/**
 * Emails a password-reset link. Fired without awaiting (see Better Auth's note
 * on timing attacks); sendEmail never throws, so nothing is left dangling.
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

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	// A placeholder keeps the postbuild analysis pass happy; the real secret is
	// required at runtime and Better Auth will reject requests without it.
	secret:
		env.BETTER_AUTH_SECRET ?? (building ? 'build-time-secret-placeholder-0000000000' : undefined),
	database: drizzleAdapter(db, { provider: 'sqlite' }),

	// Password sign-in (enabled via env). When Resend is configured, singers can
	// reset a forgotten password themselves; otherwise the host resets it.
	emailAndPassword: {
		enabled: env.AUTH_EMAIL_PASSWORD_ENABLED === 'true',
		...(emailConfigured()
			? {
					revokeSessionsOnPasswordReset: true,
					sendResetPassword: sendResetPasswordEmail
				}
			: {})
	},

	// Singers authenticate with their existing Google or Apple account.
	// Providers are only registered when credentials are configured so that
	// local builds, tests and CI work without OAuth secrets.
	socialProviders: {
		...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET
					}
				}
			: {}),
		...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
			? {
					apple: {
						clientId: env.APPLE_CLIENT_ID,
						clientSecret: env.APPLE_CLIENT_SECRET
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
