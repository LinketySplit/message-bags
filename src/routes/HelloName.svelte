<script lang="ts">
  import { page } from '$app/stores';
  import { ski18nT } from '$lib';
  import Translated from '$lib/Translated.svelte';
  $: locale = $page.data.locale || 'en-US';
  const data = { name: 'SKi18nT' };
  const messages = {
    nameInputLabel: ski18nT(
      /** the lable for the name input text box*/
      'hello-name/nameInputLabel',
      'Enter your name'
    ),
    result: ski18nT(
      /** The result displayed when the user changes their name. */
      'hello-name/result',
      (data: { name: string }) => {
        const trimmed =
          data.name.trim().length > 0 ? data.name.trim() : 'Anonymous';
        return `Hello, ${trimmed}`;
      }
    )
  };
</script>

<div>
  <label for="hello-name-input">
    <Translated {locale} t={messages.nameInputLabel} />
  </label>
  <input id="hello-name-input" type="text" bind:value={data.name} />
</div>

<p>
  <Translated {locale} t={messages.result} {data} />
</p>
