<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Choose a new password · Maintec Entertainment</title>
</svelte:head>

<section class="mx-auto max-w-sm space-y-6 py-10">
	<div class="space-y-2 text-center">
		<h1 class="text-2xl font-extrabold tracking-tight text-white">Choose a new password</h1>
	</div>

	{#if data.invalid}
		<p class="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
			This reset link is invalid or has expired.
		</p>
		<p class="text-center text-sm text-neutral-400">
			<a href={resolve('/forgot-password')} class="text-blue-400 hover:text-blue-300"
				>Request a new link</a
			>
		</p>
	{:else}
		<form
			method="post"
			class="space-y-3 rounded-lg border border-neutral-800 bg-neutral-800/60 p-4"
			use:enhance
		>
			<input type="hidden" name="token" value={data.token} />
			<input
				type="password"
				name="password"
				required
				minlength="8"
				placeholder="New password (8+ characters)"
				autocomplete="new-password"
				class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
			<input
				type="password"
				name="confirm"
				required
				minlength="8"
				placeholder="Confirm new password"
				autocomplete="new-password"
				class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
			<button
				type="submit"
				class="flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700"
			>
				Set new password
			</button>
		</form>

		{#if form?.message}
			<p class="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
				{form.message}
			</p>
		{/if}
	{/if}
</section>
