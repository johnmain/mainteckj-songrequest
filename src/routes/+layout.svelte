<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { visibleNavItems } from '$lib/config/nav';

	let { data, children } = $props();

	const items = $derived(visibleNavItems(Boolean(data.user)));
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	<meta name="theme-color" content="#171717" />
</svelte:head>

<div class="flex min-h-dvh flex-col bg-neutral-900 text-neutral-100">
	<header class="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur">
		<nav
			class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
			aria-label="Main navigation"
		>
			<a href={resolve('/')} class="flex items-center gap-3">
				<img src="/logo.png" alt="Maintec Entertainment" class="h-10 w-auto" />
				<span class="hidden text-sm leading-tight font-semibold text-neutral-100 sm:block">
					Karaoke
					<span class="block font-normal text-neutral-400">Song Requests</span>
				</span>
			</a>

			<ul class="flex flex-wrap items-center gap-1">
				{#each items as item (item.href)}
					<li>
						<a
							href={resolve(item.href)}
							aria-current={page.url.pathname === item.href ? 'page' : undefined}
							class="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-neutral-300 decoration-blue-500 underline-offset-4 transition hover:bg-neutral-800 hover:text-white hover:underline"
						>
							{item.label}
						</a>
					</li>
				{/each}

				{#if data.user}
					<li>
						<form method="post" action="/profile?/signOut">
							<button
								type="submit"
								class="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
							>
								Sign out
							</button>
						</form>
					</li>
				{:else}
					<li>
						<a
							href={resolve('/login')}
							class="inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
						>
							Sign in
						</a>
					</li>
				{/if}
			</ul>
		</nav>
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
		{@render children()}
	</main>

	<footer class="border-t border-neutral-800 px-4 py-6 text-center text-xs text-neutral-500">
		<p class="font-semibold text-neutral-400">Maintec Entertainment</p>
		<p>DJ &amp; Karaoke Services in Ethelbert &amp; Parkland, MB</p>
	</footer>
</div>
