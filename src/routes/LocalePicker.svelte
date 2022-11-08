<script lang="ts">
  import { page } from '$app/stores';
  import { ski18nT } from '$lib';
    import Ski18nTranslated from '$lib/Ski18nTranslated.svelte';

  let locale: string;

  const options = [
    {
      locale: 'en-US',
      label: ski18nT(
        /**
         * The label for the en-US locale.
         */
        'locale-picker/enUsLabel',
        'English (US)'
      )
    },
    {
      locale: 'en-GB',
      label: ski18nT(
        /**
         * The label for the en-GB locale.
         */
        'locale-picker/enGbLabel',
        'English (GB)'
      )
    },
    {
      locale: 'es-SPANGLISH',
      label: ski18nT(
        /**
         * The label for the es-SPANGLISH  locale.
         */
        'locale-picker/enSpanglishLabel',
        'Spanglish'
      )
    },
    {
      locale: 'fr-FRANGLAIS',
      label: ski18nT(
        /**
         * The label for the fr-FRANGLAIS  locale.
         */
        'locale-picker/enFranglaisLabel',
        'Franglais'
      )
    }
  ];

  $: locale = $page.data.locale || 'en-US';
  $: currentLocaleOption = options.find((o) => o.locale === locale);
  $: setLocaleHref = `/set-locale?redirect=${$page.url.pathname}&locale=`;
  $: localeCurrentlyIs = ski18nT(
    /**
     * What the locale currently is.
     */
    'locale-picker/localeCurrentlyIs',
    (data: { locale: string }) => `(currently ${data.locale})`
  );
  $: label = ski18nT(
    /**
     * Prompt to choose a locale.
     */
    'locale-picker/chooseLocaleLabel',
    'Choose locale'
  );
</script>

<div>
  <details>
    <summary>
      <Ski18nTranslated t={label} {locale}></Ski18nTranslated>

      <Ski18nTranslated t={localeCurrentlyIs} {locale} data={{locale}}></Ski18nTranslated>
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
