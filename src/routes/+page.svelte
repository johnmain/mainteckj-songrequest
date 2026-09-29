<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const genres = [
		'🎸 Classic Rock',
		'🕺 80s Power Anthems',
		'🤘 Hard Rock & Metal',
		'🤠 Country Classics',
		'🎤 Modern Pop',
		'🇨🇦 Canadian Classics'
	];
</script>

<svelte:head>
	<title>Karaoke Song Library · Maintec Entertainment</title>
	<meta
		name="description"
		content="Search the Maintec Entertainment karaoke song library and send requests straight to the KJ booth."
	/>
</svelte:head>

<section class="space-y-8 py-8">
	<div class="space-y-4">
		<p class="text-sm font-semibold tracking-widest text-blue-400 uppercase">Karaoke with John</p>
		<h1 class="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
			Maintec Entertainment Karaoke
		</h1>
		<p class="max-w-2xl text-neutral-300">
			Search our library of thousands of songs — from country classics and classic rock anthems to
			80s power ballads and current pop hits — and send your request straight to the DJ booth.
		</p>
	</div>

	<ul class="flex flex-wrap gap-2">
		{#each genres as genre (genre)}
			<li
				class="rounded-full border border-neutral-700 bg-neutral-800/60 px-3 py-1 text-sm text-neutral-300"
			>
				{genre}
			</li>
		{/each}
	</ul>

	<div class="flex flex-wrap gap-3">
		{#if data.user}
			<a
				href={resolve('/songs')}
				class="inline-flex min-h-12 items-center rounded-lg bg-blue-600 px-6 font-semibold text-white transition hover:bg-blue-700"
			>
				Request a song
			</a>
			<a
				href={resolve('/requests')}
				class="inline-flex min-h-12 items-center rounded-lg border border-neutral-700 px-6 font-semibold text-neutral-100 transition hover:bg-neutral-800"
			>
				My requests
			</a>
		{:else}
			<a
				href={resolve('/login')}
				class="inline-flex min-h-12 items-center rounded-lg bg-blue-600 px-6 font-semibold text-white transition hover:bg-blue-700"
			>
				Sign in to request a song
			</a>
		{/if}
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<div class="rounded-lg border border-neutral-800 bg-neutral-800/50 p-4">
			<p class="text-lg font-semibold text-white">🔎 Fast search</p>
			<p class="text-sm text-neutral-400">Find your favourite track instantly.</p>
		</div>
		<div class="rounded-lg border border-neutral-800 bg-neutral-800/50 p-4">
			<p class="text-lg font-semibold text-white">🎯 Instant queueing</p>
			<p class="text-sm text-neutral-400">Requests go straight to the DJ booth.</p>
		</div>
		<div class="rounded-lg border border-neutral-800 bg-neutral-800/50 p-4">
			<p class="text-lg font-semibold text-white">📱 No paper slips</p>
			<p class="text-sm text-neutral-400">Request from your table, track your turn.</p>
		</div>
	</div>
</section>
