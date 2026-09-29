<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const statusStyles: Record<string, string> = {
		pending: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
		approved: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
		playing: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
		played: 'border-neutral-600 bg-neutral-700/40 text-neutral-300',
		rejected: 'border-red-500/40 bg-red-500/10 text-red-200'
	};

	function formatDate(value: Date): string {
		return new Date(value).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	function deliveryLabel(deliveredAt: Date | null): string {
		if (deliveredAt) return `Claimed by the KJ · ${formatDate(deliveredAt)}`;
		return 'Queued — waiting for the KJ';
	}

	function isRemovable(status: string): boolean {
		return status === 'pending' || status === 'approved' || status === 'rejected';
	}

	function isPlayed(hostPlayed: boolean | null): boolean {
		return hostPlayed === true;
	}

	function canTogglePlayed(status: string): boolean {
		return status === 'approved' || status === 'playing' || status === 'played';
	}
</script>

<svelte:head>
	<title>My requests · Maintec Entertainment</title>
</svelte:head>

<section class="space-y-5 py-6">
	<header class="flex flex-wrap items-baseline justify-between gap-3">
		<h1 class="text-2xl font-extrabold tracking-tight text-white">My requests</h1>
		<a
			href={resolve('/songs')}
			class="text-sm font-semibold text-blue-400 underline-offset-4 hover:underline"
		>
			Request another song
		</a>
	</header>

	{#if data.notice}
		<p
			class="rounded-lg border p-4 text-sm {data.notice.tone === 'success'
				? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
				: 'border-amber-500/40 bg-amber-500/10 text-amber-200'}"
		>
			{data.notice.message}
		</p>
	{/if}

	{#if form?.message}
		<p
			class="rounded-lg border p-4 text-sm {form.success
				? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
				: 'border-red-500/40 bg-red-500/10 text-red-200'}"
		>
			{form.message}
		</p>
	{/if}

	{#if data.requests.length === 0}
		<p class="rounded-lg border border-neutral-800 bg-neutral-800/50 p-6 text-sm text-neutral-400">
			You haven't requested any songs yet.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each data.requests as request (request.id)}
				<li class="rounded-lg border border-neutral-800 bg-neutral-800/60 p-4">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="truncate font-bold text-white">{request.artist}</p>
							<p class="truncate text-neutral-300">{request.title}</p>
							{#if request.note}
								<p class="mt-1 truncate text-xs text-neutral-400">Note: {request.note}</p>
							{/if}
						</div>
						<span
							class="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize {statusStyles[
								request.status
							] ?? statusStyles.pending}"
						>
							{request.status}
						</span>
					</div>

					<div class="mt-2 flex flex-wrap items-center justify-between gap-3">
						<div class="flex flex-wrap items-center gap-2">
							<p class="text-xs text-neutral-500">
								{deliveryLabel(request.deliveredAt)}
							</p>

							{#if request.hostPlayed !== null}
								<span
									class="rounded-full border px-2 py-0.5 text-[11px] font-semibold {isPlayed(
										request.hostPlayed
									)
										? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
										: 'border-neutral-600 bg-neutral-700/30 text-neutral-300'}"
								>
									{isPlayed(request.hostPlayed) ? 'Played' : 'Unplayed'}
								</span>
							{/if}

							{#if request.pendingPlayed !== null}
								<span class="text-[11px] text-amber-300">Updating…</span>
							{/if}
						</div>

						<div class="flex items-center gap-2">
							{#if canTogglePlayed(request.status)}
								<form method="post" action="?/togglePlayed" use:enhance>
									<input type="hidden" name="id" value={request.id} />
									<input
										type="hidden"
										name="played"
										value={isPlayed(request.hostPlayed) ? 'false' : 'true'}
									/>
									<button
										type="submit"
										disabled={request.pendingPlayed !== null}
										class="inline-flex min-h-9 items-center rounded-lg border border-neutral-600 px-3 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-50"
									>
										{isPlayed(request.hostPlayed) ? 'Mark unplayed' : 'Mark played'}
									</button>
								</form>
							{/if}

							{#if isRemovable(request.status)}
								<form
									method="post"
									action="?/delete"
									use:enhance={({ cancel }) => {
										if (!window.confirm('Delete this song from your requests?')) {
											cancel();
										}
									}}
								>
									<input type="hidden" name="id" value={request.id} />
									<button
										type="submit"
										class="inline-flex min-h-9 items-center rounded-lg border border-red-500/40 px-3 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
									>
										Delete
									</button>
								</form>
							{/if}
						</div>
					</div>
				</li>
			{/each}
		</ul>

		{#if data.totalPages > 1}
			<nav class="flex items-center justify-between gap-3 pt-2" aria-label="Requests pagination">
				{#if data.page > 1}
					<a
						href={resolve(`/requests?page=${data.page - 1}`)}
						class="inline-flex min-h-10 items-center rounded-lg border border-neutral-700 px-4 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
					>
						Newer
					</a>
				{:else}
					<span></span>
				{/if}

				<span class="text-sm text-neutral-500">Page {data.page} of {data.totalPages}</span>

				{#if data.page < data.totalPages}
					<a
						href={resolve(`/requests?page=${data.page + 1}`)}
						class="inline-flex min-h-10 items-center rounded-lg border border-neutral-700 px-4 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
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
