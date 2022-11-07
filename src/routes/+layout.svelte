<script lang="ts">
  import type { LayoutData } from './$types';
  import LocalePicker from './LocalePicker.svelte';

  export let data: LayoutData;
  $: locale = data.locale;
</script>

<div>
  <LocalePicker />
</div>
<slot />
