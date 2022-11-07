<script lang="ts">
  export let locale: string;
  export let promise: (locale?: string) => Promise<string>;
</script>

{#await promise(locale) then message}
  {message}
{/await}
