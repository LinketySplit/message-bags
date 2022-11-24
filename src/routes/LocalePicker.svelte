<script lang="ts">
  import { page } from '$app/stores';
  import type { LayoutData } from './$types';

  export let data: LayoutData;
  const locales = [
    {
      code: 'en_US',
      label: data.localePickerMessages.locales.en_US
    },
    {
      code: 'es',
      label: data.localePickerMessages.locales.es
    }
  ];
</script>

<div>
  {data.localePickerMessages.currentLocale(data.locale)}
  <br />
  {data.localePickerMessages.prompt}:
  {#each locales as o (o.code)}
    <a href={`/locale?locale=${o.code}&redirect=${$page.url.pathname}`}
      >{o.label}</a
    >
    |
  {/each}
</div>
