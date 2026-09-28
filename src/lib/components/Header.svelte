<script lang="ts">
	import { resolve } from "$app/paths";

	const { size, pos } = $props();
	const align = pos === "right" ? "right" : "center";
	const margin = size === "small" ? "5em 4em" : "5em 6em";
	const fontSize = size === "small" ? "4.5em" : "7em";
</script>

<header
	class="header"
	style:--header-margin-block={margin}
	style:text-align={align}
>
	<a href={resolve("/")} class="logo" style:font-size={fontSize}>مصطلع</a>
</header>

<style>
	.header {
		width: min(clamp(600px, 70%, 80vw), 100%);
		text-align: center;
		margin: 0 auto;
		margin-block: var(--header-margin-block, 5em 6em);
	}

	@media (max-width: 600px) {
		/* top margin stays 5em: the fixed .controls sit in that band on the
		   pos="right" pages, where the logo is flush to the inline-start edge */
		.header {
			margin-block: 5em 3em;
		}
	}

	.logo {
		font-family: var(--font-display);
		font-size: 7rem;
		font-weight: 700;
		color: var(--color-fg);
		letter-spacing: -0.02em;
	}
</style>
