<script lang="ts">
	import { goto } from "$app/navigation";
	import { onDestroy, tick } from "svelte";
	import Header from "$lib/components/Header.svelte";
	import TermPopup from "$lib/components/TermPopup.svelte";
	import { TERM_POPUP_ID, loadTerm } from "$lib/term-cache";
	import type { Term } from "$lib/types";
	import type { PageProps } from "./$types";
	import { resolve } from "$app/paths";

	let { data }: PageProps = $props();

	const OPEN_DELAY = 130;
	const CLOSE_GRACE = 150;

	interface ActiveTerm {
		slug: string;
		category: string;
		anchor: HTMLElement;
	}

	let active = $state<ActiveTerm | null>(null);
	let term = $state<Term | null>(null);
	let loading = $state(false);
	let failed = $state(false);
	let popup = $state<HTMLElement | null>(null);
	let popupLink = $state<HTMLAnchorElement | null>(null);

	let openTimer: ReturnType<typeof setTimeout> | undefined;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	let pending: HTMLElement | null = null;
	let activeEl: HTMLElement | null = null;
	let requestId = 0;

	function termFrom(target: EventTarget | null): HTMLElement | null {
		return target instanceof Element
			? target.closest<HTMLElement>("a.term")
			: null;
	}

	function isInsidePopup(target: EventTarget | null): boolean {
		return target instanceof Node && !!popup?.contains(target);
	}

	// {@html} replaces the anchors wholesale when the article changes, so a
	// stored reference can already be detached here; its replacement carries the
	// same markup defaults and needs nothing
	function setExpanded(el: HTMLElement | null, expanded: boolean) {
		if (!el?.isConnected) {
			return;
		}
		el.setAttribute("aria-expanded", String(expanded));
		if (expanded) {
			el.setAttribute("aria-describedby", TERM_POPUP_ID);
		} else {
			el.removeAttribute("aria-describedby");
		}
	}

	function clearPending() {
		if (openTimer !== undefined) {
			clearTimeout(openTimer);
			openTimer = undefined;
		}
		pending = null;
	}

	function cancelClose() {
		if (closeTimer !== undefined) {
			clearTimeout(closeTimer);
			closeTimer = undefined;
		}
	}

	// the term and the card are two separate boxes with a gap between them, so
	// closing on the first mouseleave would flicker on every crossing
	function armClose() {
		cancelClose();
		closeTimer = setTimeout(() => {
			closeTimer = undefined;
			close();
		}, CLOSE_GRACE);
	}

	function close() {
		cancelClose();
		clearPending();
		requestId++;
		setExpanded(activeEl, false);
		// only reclaim the focus if the popup still owns it: taking it back after
		// the user tabbed off somewhere else would yank them out of the article
		if (activeEl?.isConnected && popup?.contains(document.activeElement)) {
			activeEl.focus({ preventScroll: true });
		}
		activeEl = null;
		active = null;
		term = null;
		loading = false;
		failed = false;
	}

	async function focusCard() {
		await tick();
		popupLink?.focus();
	}

	function open(el: HTMLElement, focusLink = false) {
		const slug = el.dataset.termSlug;
		const category = el.dataset.termCategory;
		if (!slug || !category) {
			return;
		}

		if (el === activeEl) {
			if (focusLink) {
				void focusCard();
			}
			return;
		}

		cancelClose();
		clearPending();
		setExpanded(activeEl, false);
		activeEl = el;
		setExpanded(el, true);
		active = { slug, category, anchor: el };
		term = null;
		loading = true;
		failed = false;

		const id = ++requestId;
		loadTerm(category, slug).then(
			(loaded) => {
				if (id !== requestId) {
					return;
				}
				loading = false;
				term = loaded;
				if (focusLink) {
					void focusCard();
				}
			},
			() => {
				if (id !== requestId) {
					return;
				}
				loading = false;
				failed = true;
			},
		);
	}

	function schedule(el: HTMLElement) {
		cancelClose();
		if (el === activeEl || el === pending) {
			return;
		}
		clearPending();
		pending = el;
		openTimer = setTimeout(() => {
			openTimer = undefined;
			const target = pending;
			pending = null;
			if (target) {
				open(target);
			}
		}, OPEN_DELAY);
	}

	function onArticleLeave(event: MouseEvent) {
		if (!active && !pending) {
			return;
		}
		if (isInsidePopup(event.relatedTarget)) {
			cancelClose();
			return;
		}
		armClose();
	}

	function onPopupLeave(event: MouseEvent) {
		const next = event.relatedTarget;
		if (
			(next instanceof Element && next.closest("a.term")) ||
			isInsidePopup(next)
		) {
			return;
		}
		armClose();
	}

	function onFocusOut(event: FocusEvent) {
		if (!termFrom(event.target)) {
			return;
		}
		const next = event.relatedTarget;
		if (next instanceof Element && next.closest("a.term")) {
			return;
		}
		if (isInsidePopup(next)) {
			return;
		}
		armClose();
	}

	// delegated on body: the term anchors come from {@html}, so there is no
	// component-level element to hang the handler on
	function onKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			const el = termFrom(event.target);
			if (el) {
				event.preventDefault();
				clearPending();
				open(el, true);
			}
			return;
		}

		if (event.key !== "Escape") {
			return;
		}

		if (active || pending) {
			close();
			return;
		}

		goto(resolve("/articles"));
	}

	function onClick(event: MouseEvent) {
		// let modified and non-primary clicks reach the browser so the link opens
		// in a new tab or window
		if (
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		const el = termFrom(event.target);
		if (!el) {
			return;
		}
		event.preventDefault();
		// a tap on a coarse pointer only reaches click when the element is not
		// focusable, so opening here is what makes the popup appear on touch
		open(el);
	}

	// iOS does not blur on taps that land outside anything focusable, so the
	// popup would otherwise stay glued to the page
	function onPointerDown(event: PointerEvent) {
		if (!active && !pending) {
			return;
		}
		// term anchors are excluded so switching terms is the click handler's job
		if (isInsidePopup(event.target) || termFrom(event.target)) {
			return;
		}
		close();
	}

	function onPopupNavigate(href: string) {
		void goto(href).then(close, close);
	}

	$effect(() => {
		void data.article;
		void data.category;
		close();
	});

	onDestroy(() => {
		cancelClose();
		clearPending();
	});
</script>

<svelte:body
	onkeydown={onKeydown}
	onclick={onClick}
	onpointerdown={onPointerDown}
/>

<Header size="small" pos="right" />

<div class="article-page">
	<a href={resolve("/articles")} class="back" id="backBtn">
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="m9 18 6-6-6-6" />
		</svg>
	</a>

	<article
		class="content"
		onmouseover={(event: MouseEvent) => {
			const el = termFrom(event.target);
			if (el) {
				schedule(el);
			}
		}}
		onmouseleave={onArticleLeave}
		onfocusin={(event: FocusEvent) => {
			const el = termFrom(event.target);
			if (el) {
				schedule(el);
			}
		}}
		onfocusout={onFocusOut}
	>
		{@html data.html}
	</article>
</div>

{#if active}
	<div
		bind:this={popup}
		onmouseenter={cancelClose}
		onmouseleave={onPopupLeave}
		onfocusin={cancelClose}
	>
		<TermPopup
			slug={active.slug}
			category={active.category}
			anchor={active.anchor}
			{loading}
			{term}
			{failed}
			bind:link={popupLink}
			onnavigate={onPopupNavigate}
		/>
	</div>
{/if}

<style>
	.article-page {
		width: clamp(600px, 60%, 80vw);
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.back {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--color-bg);
		border-radius: 50%;
		margin-bottom: 1rem;
	}

	.content {
		font-family: var(--font-arabic);
		direction: rtl;
		line-height: 1.8;
	}

	.content :global(h1) {
		font-size: 2rem;
		margin-bottom: 1rem;
	}

	.content :global(h2) {
		font-size: 1.5rem;
		margin-top: 2rem;
		margin-bottom: 0.75rem;
	}

	.content :global(p) {
		margin-bottom: 1rem;
	}

	.content :global(a:not(.term)) {
		color: var(--color-accent);
	}

	.content :global(code) {
		background: var(--color-bg);
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		font-family: var(--font-english);
	}

	.content :global(pre) {
		background: var(--color-bg);
		padding: 1rem;
		border-radius: 8px;
		overflow-x: auto;
	}

	.content :global(pre code) {
		background: none;
		padding: 0;
	}

	.content :global(a.term) {
		color: var(--color-text);
		cursor: help;
		text-decoration: underline dotted var(--color-accent);
		text-underline-offset: 0.25em;
		border-radius: var(--radius-sm);
	}

	.content :global(a.term:hover) {
		background: var(--color-bg-alt);
	}

	.content :global(a.term:focus-visible) {
		background: var(--color-bg-alt);
		outline: 1px solid var(--color-accent);
		outline-offset: 2px;
	}
</style>
