<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(value: Date): string {
		return new Date(value).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}
</script>

<svelte:head>
	<title>Song history · Maintec Entertainment</title>
</svelte:head>

<section class="space-y-5 py-6">
	<header class="flex items-baseline justify-between gap-3">
		<h1 class="text-2xl font-extrabold tracking-tight text-white">Song history</h1>
		<span class="text-sm text-neutral-400">{data.total} performed</span>
	</header>

	{#if data.entries.length === 0}
		<p class="rounded-lg border border-neutral-800 bg-neutral-800/50 p-6 text-sm text-neutral-400">
			No songs yet. Once you perform a request, it will show up here.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each data.entries as entry (entry.id)}
				<li
					class="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-800/60 p-4"
				>
					<div class="min-w-0">
						<p class="truncate font-bold text-white">{entry.artist}</p>
						<p class="truncate text-neutral-300">{entry.title}</p>
					</div>
					<time
						class="shrink-0 text-xs text-neutral-500"
						datetime={new Date(entry.sungAt).toISOString()}
					>
						{formatDate(entry.sungAt)}
					</time>
				</li>
			{/each}
		</ul>

		{#if data.totalPages > 1}
			<nav class="flex items-center justify-between gap-3 pt-2" aria-label="History pagination">
				{#if data.page > 1}
					<a
						href={resolve(`/history?page=${data.page - 1}`)}
						class="inline-flex min-h-11 items-center rounded-lg border border-neutral-700 px-4 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
					>
						Newer
					</a>
				{:else}
					<span></span>
				{/if}

				<span class="text-sm text-neutral-500">Page {data.page} of {data.totalPages}</span>

				{#if data.page < data.totalPages}
					<a
						href={resolve(`/history?page=${data.page + 1}`)}
						class="inline-flex min-h-11 items-center rounded-lg border border-neutral-700 px-4 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
					>
						Older
					</a>
				{:else}
					<span></span>
				{/if}
			</nav>
		{/if}
	{/if}
</section>
