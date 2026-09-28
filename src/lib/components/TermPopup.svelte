<script lang="ts">
	import { untrack } from "svelte";
	import { resolve } from "$app/paths";
	import { TERM_POPUP_ID } from "$lib/term-cache";
	import type { Term } from "$lib/types";

	interface Props {
		slug: string;
		category: string;
		anchor: HTMLElement | null;
		loading: boolean;
		term: Term | null;
		failed: boolean;
		link?: HTMLAnchorElement | null;
		onnavigate?: (href: string) => void;
	}

	let {
		slug,
		category,
		anchor,
		loading,
		term,
		failed,
		link = $bindable(null),
		onnavigate,
	}: Props = $props();

	const GAP = 8;
	const EDGE = 8;

	let card = $state<HTMLElement | null>(null);
	let top = $state(0);
	let left = $state(0);
	let flipped = $state(false);
	let placed = $state(false);

	let href = $derived(resolve("/[category]", { category }) + "?term=" + slug);

	// the card is position: fixed, so the clamps must run against what the user
	// can actually see: on mobile innerHeight still counts the shrunken URL bar
	// while visualViewport.height does not, and max-height is 100dvh
	function viewportHeight() {
		return window.visualViewport?.height ?? window.innerHeight;
	}

	// re-reads the anchor box every time: the card is position: fixed, so a rect
	// captured once goes stale as soon as the page scrolls or the viewport moves
	function measure() {
		untrack(() => {
			const el = card;
			const anchorEl = anchor;
			if (!el || !anchorEl) {
				return;
			}

			const height = el.offsetHeight;
			const width = el.offsetWidth;
			const rect = anchorEl.getBoundingClientRect();
			const roomBelow = viewportHeight() - rect.bottom;

			flipped = roomBelow < height + GAP && rect.top > height + GAP;

			const wantedTop = flipped ? rect.top - GAP : rect.bottom + GAP;
			const minTop = EDGE + (flipped ? height : 0);
			const maxTop = viewportHeight() - EDGE - (flipped ? 0 : height);
			top = Math.min(Math.max(wantedTop, minTop), Math.max(minTop, maxTop));

			const wantedLeft = rect.right - width;
			left = Math.min(
				Math.max(EDGE, wantedLeft),
				Math.max(EDGE, window.innerWidth - width - EDGE),
			);

			placed = true;
		});
	}

	$effect(() => {
		const anchorEl = anchor;
		// the card box changes with whatever content just landed, so measure again then
		void loading;
		void failed;
		void term?.title;

		if (!card || !anchorEl) {
			return;
		}

		measure();
		const viewport = window.visualViewport;
		window.addEventListener("scroll", measure, true);
		window.addEventListener("resize", measure);
		viewport?.addEventListener("resize", measure);

		return () => {
			window.removeEventListener("scroll", measure, true);
			window.removeEventListener("resize", measure);
			viewport?.removeEventListener("resize", measure);
		};
	});
</script>

{#if anchor}
	<div
		bind:this={card}
		id={TERM_POPUP_ID}
		role="dialog"
		aria-modal="false"
		class="term-popup"
		class:term-popup-flip={flipped}
		class:term-popup-placed={placed}
		style:top="{top}px"
		style:left="{left}px"
	>
		{#if loading}
			<div class="term-popup-loading">جارٍ التحميل…</div>
		{:else if failed}
			<div class="term-popup-failed">تعذّر تحميل المصطلح</div>
		{:else if term}
			<div class="term-popup-title">
				{term.title}
				{#if term.abbrev}
					<span class="term-popup-abbrev">({term.abbrev})</span>
				{/if}
			</div>

			{#if term.tags.length}
				<div class="term-popup-tags">
					{#each term.tags as tag}
						<span class="term-popup-tag">{tag}</span>
					{/each}
				</div>
			{/if}

			{#if term.description}
				<p class="term-popup-desc">{term.description}</p>
			{/if}

			{#if term.arabicWords.length}
				<div class="term-popup-words">
					{#each term.arabicWords as arabicWord}
						<span class="term-popup-word">{arabicWord.word}</span>
					{/each}
				</div>
			{/if}

			<a
				bind:this={link}
				class="term-popup-link"
				{href}
				onclick={(event: MouseEvent) => {
					if (
						event.button !== 0 ||
						event.metaKey ||
						event.ctrlKey ||
						event.shiftKey ||
						event.altKey
					) {
						return;
					}
					// plain clicks navigate through the page so the popup is not
					// torn down from under the anchor mid-dispatch
					event.preventDefault();
					onnavigate?.(href);
				}}
			>
				اقرأ المزيد
			</a>
		{/if}
	</div>
{/if}

<style>
	.term-popup {
		position: fixed;
		z-index: 100;
		width: max-content;
		max-width: min(320px, calc(100vw - 1rem));
		max-height: calc(100vh - 16px);
		max-height: calc(100dvh - 16px);
		overflow-y: auto;
		overscroll-behavior: contain;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.7rem 0.8rem;
		background: var(--color-bg);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		direction: rtl;
		visibility: hidden;
	}

	.term-popup-placed {
		visibility: visible;
	}

	.term-popup-flip {
		transform: translateY(-100%);
	}

	.term-popup-title {
		font-family: var(--font-english);
		font-size: 0.95rem;
		font-weight: bold;
		line-height: 1.3;
		text-align: start;
	}

	.term-popup-abbrev {
		font-size: 0.75rem;
		font-weight: normal;
		color: var(--color-text-secondary);
	}

	.term-popup-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.term-popup-tag {
		font-size: 0.55rem;
		padding: 0.15rem 0.45rem;
		background: var(--color-tag);
		color: var(--color-tag-text);
		border-radius: var(--radius-sm);
	}

	.term-popup-desc {
		font-size: 0.8rem;
		line-height: 1.7;
		color: var(--color-text-secondary);
		white-space: pre-line;
		max-height: 9rem;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.term-popup-words {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-border);
	}

	.term-popup-word {
		font-size: 0.8rem;
		color: var(--color-fg-dim);
	}

	.term-popup-link {
		align-self: flex-start;
		font-size: 0.75rem;
		color: var(--color-accent);
		border-bottom: 1px solid transparent;
	}

	.term-popup-link:hover {
		border-bottom-color: var(--color-accent);
	}

	.term-popup-loading {
		min-width: 180px;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		animation: term-popup-pulse 1.2s ease-in-out infinite;
	}

	.term-popup-failed {
		min-width: 180px;
		font-size: 0.8rem;
		color: var(--color-primary);
	}

	@keyframes term-popup-pulse {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 1;
		}
	}
</style>
