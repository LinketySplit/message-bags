<script lang="ts">
  import { t } from '$lib';
  import type { PageData } from './$types';
    import HelloName from './HelloName.svelte';
  export let data: PageData;
  $: locale = data.locale;
</script>

<h1>
  {#await t('home/welcomeMessage', 'Welcome to ski18nT!')(locale) then value}
    {value}
  {/await}
</h1>
<p>
  {#await t('home/tagline', 'An exploration of i18n in SvelteKit')(locale) then value}
    {value}
  {/await}
</p>

<div>
  <HelloName/>
</div>
