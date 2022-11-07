<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$lib';

  let locale: string;

  const options = [
    {
      locale: 'en-US',
      label: t('locale-picker/enUsLabel', 'English (US)')
    },
    {
      locale: 'en-GB',
      label: t('locale-picker/enGbLabel', 'English (GB)')
    },
    {
      locale: 'es-SPANGLISH',
      label: t('locale-picker/enSpanglishLabel', 'Spanglish')
    },
    {
      locale: 'fr-FRANGLAIS',
      label: t('locale-picker/enFranglaisLabel', 'Franglais')
    }
  ];

  $: locale = $page.data.locale || 'en-US';
  $: currentLocaleOption = options.find((o) => o.locale === locale);
  $: setLocaleHref = `/set-locale?redirect=${$page.url.pathname}&locale=`;
  $: localeCurrentlyIs = t('locale-picker/localeCurrentlyIs', (data: {locale: string}) => `(currently ${data.locale})`)
</script>

<div>
  <details>
    <summary>
      {#await t('locale-picker/chooseLocaleLabel', 'Choose locale')(locale)}
        Choose locale
      {:then label}
        {label}
      {/await}
      {#await localeCurrentlyIs({locale}, locale)}
        
        ...
      {:then message}
        {message}
      {/await}
    </summary>
    <div>
      {#each options as opt (opt.locale)}
        {@const href = `${setLocaleHref}${opt.locale}`}
        <div>
          <a {href}>
            {#if opt.locale === locale}
              🔘
            {:else}
              ⚪️
            {/if}
            {#await opt.label(locale)}
              {opt.locale}
            {:then label}
              {label}
            {/await}
          </a>
        </div>
      {/each}
    </div>
  </details>
</div>
