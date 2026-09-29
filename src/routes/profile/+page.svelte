<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let saving = $state(false);

	const memberSince = $derived(
		data.user.createdAt ? new Date(data.user.createdAt).toLocaleDateString() : null
	);

	function field(name: 'stageName' | 'phone' | 'bio'): string {
		const submitted = form?.values?.[name];
		if (typeof submitted === 'string' && submitted.length > 0) return submitted;
		return data.profile?.[name] ?? '';
	}
</script>

<svelte:head>
	<title>My profile · Maintec Entertainment</title>
</svelte:head>

<section class="space-y-6 py-6">
	<h1 class="text-2xl font-extrabold tracking-tight text-white">My profile</h1>

	<div class="flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-800/60 p-5">
		{#if data.user.image}
			<img
				src={data.user.image}
				alt=""
				class="size-14 rounded-full object-cover"
				referrerpolicy="no-referrer"
			/>
		{:else}
			<div
				class="flex size-14 items-center justify-center rounded-full bg-neutral-700 text-xl font-bold text-white"
			>
				{data.user.name?.charAt(0)?.toUpperCase() ?? '?'}
			</div>
		{/if}

		<div class="min-w-0">
			<p class="truncate text-lg font-semibold text-white">{data.user.name}</p>
			<p class="truncate text-sm text-neutral-400">{data.user.email}</p>
			{#if memberSince}
				<p class="text-xs text-neutral-500">Member since {memberSince}</p>
			{/if}
		</div>
	</div>

	<form
		method="post"
		action="?/updateProfile"
		class="space-y-4 rounded-lg border border-neutral-800 bg-neutral-800/60 p-5"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update();
				saving = false;
			};
		}}
	>
		<div>
			<h2 class="text-lg font-semibold text-white">Singer details</h2>
			<p class="text-sm text-neutral-400">Shown to the KJ when you request a song.</p>
		</div>

		<label class="block space-y-1">
			<span class="text-sm font-medium text-neutral-300">Stage name</span>
			<input
				name="stageName"
				maxlength="80"
				value={field('stageName')}
				placeholder="How should the KJ announce you?"
				class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
		</label>

		<label class="block space-y-1">
			<span class="text-sm font-medium text-neutral-300">Phone</span>
			<input
				name="phone"
				type="tel"
				maxlength="40"
				value={field('phone')}
				placeholder="Optional contact number"
				class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
		</label>

		<label class="block space-y-1">
			<span class="text-sm font-medium text-neutral-300">Bio</span>
			<textarea
				name="bio"
				rows="3"
				maxlength="500"
				value={field('bio')}
				placeholder="Optional note for the host"
				class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			></textarea>
		</label>

		<div class="flex flex-wrap items-center gap-3">
			<button
				type="submit"
				disabled={saving}
				class="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
			>
				{saving ? 'Saving…' : 'Save profile'}
			</button>

			<a
				href={resolve('/history')}
				class="text-sm font-semibold text-blue-400 underline-offset-4 hover:underline"
			>
				View song history
			</a>
		</div>

		{#if form?.message}
			<p class={form.success ? 'text-sm text-emerald-300' : 'text-sm text-red-300'}>
				{form.message}
			</p>
		{/if}
	</form>

	<form method="post" action="?/signOut" use:enhance>
		<button
			type="submit"
			class="inline-flex min-h-11 items-center rounded-lg border border-neutral-700 px-5 font-medium text-neutral-200 transition hover:bg-neutral-800"
		>
			Sign out
		</button>
	</form>
</section>
