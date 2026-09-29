import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	// A placeholder keeps the postbuild analysis pass happy; the real secret is
	// required at runtime and Better Auth will reject requests without it.
	secret:
		env.BETTER_AUTH_SECRET ?? (building ? 'build-time-secret-placeholder-0000000000' : undefined),
	database: drizzleAdapter(db, { provider: 'sqlite' }),

	// Optional password sign-in for local testing. Disabled unless explicitly
	// enabled via env; production uses Google/Apple OAuth.
	emailAndPassword: {
		enabled: env.AUTH_EMAIL_PASSWORD_ENABLED === 'true'
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
