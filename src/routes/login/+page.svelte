<script lang="ts">
	import { enhance } from '$app/forms';
	import { authClient } from '$lib/auth-client';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let pending = $state<'google' | 'apple' | null>(null);
	let errorMessage = $state<string | null>(null);
</script>

<svelte:head>
	<title>Sign in · Maintec Entertainment</title>
</svelte:head>

<section class="mx-auto max-w-sm space-y-6 py-10">
	<div class="space-y-2 text-center">
		<h1 class="text-2xl font-extrabold tracking-tight text-white">Sign in</h1>
		<p class="text-sm text-neutral-400">Sign in to search the catalog and request songs.</p>
	</div>

	<div class="space-y-3">
		{#if data.providers.google}
			<button
				type="button"
				onclick={async () => {
					pending = 'google';
					const { error } = await authClient.signIn.social({
						provider: 'google',
						callbackURL: '/songs'
					});
					if (error) {
						errorMessage = error.message ?? 'Sign in failed.';
						pending = null;
					}
				}}
				disabled={pending !== null}
				class="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-white px-4 font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-60"
			>
				{pending === 'google' ? 'Redirecting…' : 'Continue with Google'}
			</button>
		{/if}

		{#if data.providers.apple}
			<button
				type="button"
				onclick={async () => {
					pending = 'apple';
					const { error } = await authClient.signIn.social({
						provider: 'apple',
						callbackURL: '/songs'
					});
					if (error) {
						errorMessage = error.message ?? 'Sign in failed.';
						pending = null;
					}
				}}
				disabled={pending !== null}
				class="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-black px-4 font-semibold text-white ring-1 ring-neutral-700 transition hover:bg-neutral-900 disabled:opacity-60"
			>
				{pending === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
			</button>
		{/if}
	</div>

	{#if !data.providers.google && !data.providers.apple && !data.providers.emailPassword}
		<p class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
			No sign-in providers are configured. Add Google/Apple credentials or set
			<code>AUTH_EMAIL_PASSWORD_ENABLED=true</code> for local testing.
		</p>
	{/if}

	{#if data.providers.emailPassword}
		<div class="flex items-center gap-3 text-xs tracking-wide text-neutral-500 uppercase">
			<span class="h-px flex-1 bg-neutral-800"></span>
			Local testing
			<span class="h-px flex-1 bg-neutral-800"></span>
		</div>

		<form
			method="post"
			action="?/signInEmail"
			class="space-y-3 rounded-lg border border-neutral-800 bg-neutral-800/60 p-4"
			use:enhance
		>
			<p class="text-sm font-semibold text-neutral-200">Sign in with email</p>
			<input
				type="email"
				name="email"
				required
				placeholder="Email"
				autocomplete="email"
				class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
			<input
				type="password"
				name="password"
				required
				placeholder="Password"
				autocomplete="current-password"
				class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
			<button
				type="submit"
				class="flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700"
			>
				Sign in
			</button>
		</form>

		<details class="rounded-lg border border-neutral-800 bg-neutral-800/60 p-4">
			<summary class="cursor-pointer text-sm font-semibold text-neutral-200">
				Create a local test account
			</summary>
			<form method="post" action="?/signUpEmail" class="mt-3 space-y-3" use:enhance>
				<input
					name="name"
					required
					placeholder="Display name"
					autocomplete="name"
					class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
				<input
					type="email"
					name="email"
					required
					placeholder="Email"
					autocomplete="email"
					class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
				<input
					type="password"
					name="password"
					required
					minlength="8"
					placeholder="Password (8+ characters)"
					autocomplete="new-password"
					class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
				<button
					type="submit"
					class="flex min-h-11 w-full items-center justify-center rounded-lg border border-neutral-700 px-4 font-semibold text-neutral-100 transition hover:bg-neutral-800"
				>
					Create account
				</button>
			</form>
		</details>
	{/if}

	{#if form?.message}
		<p class="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
			{form.message}
		</p>
	{/if}

	{#if errorMessage}
		<p class="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
			{errorMessage}
		</p>
	{/if}
</section>
