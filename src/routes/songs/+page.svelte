<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state<string | null>(null);
</script>

<svelte:head>
	<title>Request a song · Maintec Entertainment</title>
</svelte:head>

<section class="space-y-5 py-6">
	<header class="space-y-1">
		<h1 class="text-2xl font-extrabold tracking-tight text-white">Request a song</h1>
		<p class="text-sm text-neutral-400">
			Search by title or artist — typos are okay — and send it to the KJ.
		</p>
	</header>

	<form method="get" action={resolve('/songs')} class="flex flex-col gap-3 sm:flex-row">
		<input
			type="search"
			name="q"
			value={data.query}
			placeholder="Search by song title or artist…"
			class="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
		<select
			name="sort"
			aria-label="Sort results"
			onchange={(event) => event.currentTarget.form?.requestSubmit()}
			class="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-3 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none"
		>
			{#if data.query}
				<option value="relevance" selected={data.sort === 'relevance'}>Best match</option>
			{/if}
			<option value="artist" selected={data.sort === 'artist'}>Artist A–Z</option>
			<option value="title" selected={data.sort === 'title'}>Song A–Z</option>
		</select>
		<button
			type="submit"
			class="rounded-lg bg-blue-600 px-6 py-3 font-semibold whitespace-nowrap text-white transition hover:bg-blue-700"
		>
			Search
		</button>
	</form>

	{#if form?.message}
		<p class="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
			{form.message}
		</p>
	{/if}

	<p class="text-sm text-neutral-400">
		{#if data.query}
			Results for <span class="font-semibold text-neutral-200">“{data.query}”</span>
		{:else}
			Browse the library — start typing to narrow it down.
		{/if}
	</p>

	{#if data.results.length === 0}
		<p class="rounded-lg border border-neutral-800 bg-neutral-800/50 p-6 text-sm text-neutral-400">
			{#if data.query}
				No songs matched “{data.query}”. Try a different spelling or a shorter search.
			{:else}
				The catalog is empty. Import a song list to get started.
			{/if}
		</p>
	{:else}
		<ul class="space-y-2">
			{#each data.results as song (song.id)}
				<li class="rounded-lg border border-neutral-800 bg-neutral-800/60 p-4">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div class="min-w-0">
							<p class="truncate font-bold text-white">{song.artist}</p>
							<p class="truncate text-neutral-300">{song.title}</p>
						</div>

						<form
							method="post"
							action="?/request"
							class="flex items-center gap-2"
							use:enhance={() => {
								submitting = song.id;
								return async ({ update }) => {
									await update();
									submitting = null;
								};
							}}
						>
							<input type="hidden" name="songId" value={song.id} />
							<input
								name="note"
								placeholder="Note (optional)"
								class="w-32 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none sm:w-44"
							/>
							<button
								type="submit"
								disabled={submitting === song.id}
								class="inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-blue-700 disabled:opacity-60"
							>
								{submitting === song.id ? 'Sending…' : 'Request'}
							</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>

		{#if data.page > 1 || data.hasMore}
			<nav class="flex items-center justify-between gap-3 pt-2" aria-label="Search pagination">
				{#if data.page > 1}
					<a
						href={resolve(
							`/songs?q=${encodeURIComponent(data.query)}&sort=${data.sort}&page=${data.page - 1}`
						)}
						class="inline-flex min-h-10 items-center rounded-lg border border-neutral-700 px-4 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
					>
						Previous
					</a>
				{:else}
					<span></span>
				{/if}

				<span class="text-sm text-neutral-500">Page {data.page}</span>

				{#if data.hasMore}
					<a
						href={resolve(
							`/songs?q=${encodeURIComponent(data.query)}&sort=${data.sort}&page=${data.page + 1}`
						)}
						class="inline-flex min-h-10 items-center rounded-lg border border-neutral-700 px-4 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
					>
						Next
					</a>
				{:else}
					<span></span>
				{/if}
			</nav>
		{/if}
	{/if}
</section>
