<script lang="ts">
	import "$lib/assets/styles.css";
	import ThemeToggle from "$lib/components/ThemeToggle.svelte";
	const { children } = $props();
</script>

<ThemeToggle />
<main class="main">
	{@render children()}
</main>

<style>
	.main {
		display: flex;
		flex-direction: column;
		width: min(clamp(600px, 90%, 80vw), 100%);
		margin: 0 auto;
		height: 100vh;
		height: 100dvh;
	}
</style>
