<script lang="ts">
  import Input from "src/partials/Input.svelte"
  import Textarea from "src/partials/Textarea.svelte"
  import ImageInput from "src/partials/ImageInput.svelte"
  import Anchor from "src/partials/Anchor.svelte"
  import Heading from "src/partials/Heading.svelte"
  import NsecWarning from "src/app/shared/NsecWarning.svelte"
  import {writable} from "src/engine"

  export let profile
  export let setStage

  const nsecWarning = writable(null)

  const bypassNsecWarning = () => {
    nsecWarning.set(null)
    next({skipNsecWarning: true})
  }

  const prev = () => setStage("intro")

  const next = ({skipNsecWarning = false} = {}) => {
    if (
      !skipNsecWarning &&
      Object.values(profile)
        .join(" ")
        .match(/\bnsec1.+/)
    ) {
      return nsecWarning.set(true)
    }

    setStage("key")
  }
</script>

<Heading class="text-center">Introduce Yourself</Heading>
<p>
  Give other people something to go on. Your profile information is publicly available, so just
  remember that "privacy is the power to selectively reveal oneself to the world".
</p>
<div class="flex flex-col gap-2">
  <div class="flex flex-col gap-1">
    <strong>Your Name</strong>
    <Input type="text" name="name" wrapperClass="flex-grow" bind:value={profile.name}>
      <i slot="before" class="fa-solid fa-user-astronaut" />
    </Input>
  </div>
  <div class="flex flex-col gap-1">
    <strong>About You</strong>
    <Textarea name="about" bind:value={profile.about} />
  </div>
  <div class="flex flex-col gap-1">
    <strong>Profile Picture</strong>
    <ImageInput bind:value={profile.picture} icon="image-portrait" maxWidth={480} maxHeight={480} />
  </div>
</div>
<div class="flex gap-2">
  <Anchor button on:click={prev}><i class="fa fa-arrow-left" /></Anchor>
  <Anchor button accent class="flex-grow" on:click={() => next()}>Continue</Anchor>
</div>

{#if $nsecWarning}
  <NsecWarning onAbort={() => nsecWarning.set(null)} onBypass={bypassNsecWarning} />
{/if}
