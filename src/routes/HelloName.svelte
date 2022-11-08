<script lang="ts">
  import { page } from '$app/stores';
  import { ski18nT } from '$lib';
  import Ski18nTranslated from '$lib/Ski18nSki18nTranslated.svelte';
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
  const conflict = ski18nT(
    /** a conflict */ 
    'hello-name/result', 'woot')
</script>

<div>
  <label for="hello-name-input">
    <Ski18nTranslated {locale} t={messages.nameInputLabel} />
  </label>
  <input id="hello-name-input" type="text" bind:value={data.name} />
</div>

<p>
  <Ski18nTranslated {locale} t={messages.result} {data} />
</p>
