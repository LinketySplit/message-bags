<script lang="ts">
  export let locale: string;
  export let data: any = undefined;
  export let t: (...args: any[]) => Promise<string>;
</script>

{#if data}
  {#await t(data, locale)}
    <slot />
  {:then message}
    {message}
  {/await}
{:else}
  {#await t(locale)}
    <slot />
  {:then message}
    {message}
  {/await}
{/if}