<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Reset password · Maintec Entertainment</title>
</svelte:head>

<section class="mx-auto max-w-sm space-y-6 py-10">
	<div class="space-y-2 text-center">
		<h1 class="text-2xl font-extrabold tracking-tight text-white">Reset your password</h1>
		<p class="text-sm text-neutral-400">We'll email you a link to choose a new password.</p>
	</div>

	{#if form?.sent}
		<p
			class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200"
		>
			If that address is registered, a reset link is on its way. Check your inbox (and spam).
		</p>
	{:else if !data.available}
		<p class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
			Password reset isn't available. Ask the host for help.
		</p>
	{:else}
		<form
			method="post"
			class="space-y-3 rounded-lg border border-neutral-800 bg-neutral-800/60 p-4"
			use:enhance
		>
			<input
				type="email"
				name="email"
				required
				placeholder="Email"
				autocomplete="email"
				class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
			<button
				type="submit"
				class="flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700"
			>
				Email me a reset link
			</button>
		</form>
	{/if}

	{#if form?.message}
		<p class="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
			{form.message}
		</p>
	{/if}

	<p class="text-center text-sm text-neutral-400">
		<a href={resolve('/login')} class="text-blue-400 hover:text-blue-300">Back to sign in</a>
	</p>
</section>
