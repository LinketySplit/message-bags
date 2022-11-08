<script lang="ts">
  import { ski18nT } from '$lib';
  import Ski18nTranslated from '$lib/Ski18nSki18nTranslated.svelte';
  import type { PageData } from './$types';
  import HelloName from './HelloName.svelte';
  export let data: PageData;
  $: locale = data.locale;
  const messages = {
    welcome: ski18nT(
      /** The brand welcome message */
      'home/welcomeMessage',
      'Welcome to ski18nT!'
    ),
    tagline: ski18nT(
      /** The brand tagline. */
      'home/tagline',
      'An exploration of i18n in SvelteKit'
    )
  };
</script>

<h1>
  <Ski18nTranslated t={messages.welcome} {locale} />
</h1>
<p>
  <Ski18nTranslated t={messages.tagline} {locale} />
</p>

<div>
  <HelloName />
</div>
