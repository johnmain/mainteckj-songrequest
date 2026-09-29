import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient({
	// Same-origin by default: the portal and the auth API are served together.
	fetchOptions: {
		onError: (ctx) => {
			console.error('[auth]', ctx.error);
		}
	}
});

export const { signIn, signOut, useSession } = authClient;
