<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$lib';
  import T from '$lib/T.svelte';
  $: locale = $page.data.locale || 'en-US';
  const data = { name: 'SKi18nT' };
  const messages = {
    nameInputLabel: t('hello-name/nameInputLabel', 'Enter your name'),
    result: t( 'hello-name/result', (data: {name: string}) => {
        const trimmed =
           data.name.trim().length > 0
            ? data.name.trim()
            : 'Anonymous';
        return `Hello, ${trimmed}`;
      })
  };
</script>

<div>
  <label for="hello-name-input">
    <T {locale} t={messages.nameInputLabel} />
  </label>
  <input id="hello-name-input" type="text" bind:value={data.name} />
</div>

<p>
  <T {locale} t={messages.result} {data} />
</p>
