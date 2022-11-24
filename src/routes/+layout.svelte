<script lang="ts">
  import type { LayoutData} from './$types';
    import LocalePicker from './LocalePicker.svelte';
  export let data: LayoutData;
</script>
<div>
  <LocalePicker {data}/>
</div>

<slot/>