<script lang="ts">
  import {Capacitor} from "@capacitor/core"
  import Anchor from "src/partials/Anchor.svelte"
  import Content from "src/partials/Content.svelte"
  import Heading from "src/partials/Heading.svelte"
  import {withExtension, loginWithExtension} from "src/engine"
  import {router} from "src/app/router"
  import {boot} from "src/app/state"

  const nip07 = "https://github.com/nostr-protocol/nips/blob/master/07.md"

  const autoLogIn = () =>
    withExtension(async ext => {
      const pubkey = ext && (await ext.getPublicKey())

      if (pubkey) {
        loginWithExtension(pubkey)
        boot()
      } else {
        router.at("login/privkey").replaceModal()
      }
    })

  const signUp = () => router.at("onboarding").replaceModal()

  const advancedLogIn = () => router.at("login/advanced").replaceModal()

  document.title = "Log In"
</script>

<Content size="lg" class="text-center">
  <div class="flex max-w-2xl flex-col gap-8">
    <Heading>Welcome!</Heading>
    <p class="text-center">
      Click below to log in or create an account.
      {#if !Capacitor.isNativePlatform()}
        If you have a <Anchor class="underline" href={nip07} external
          >compatible browser extension</Anchor> installed, we will use that.
      {/if}
    </p>
    <div class="flex flex-col items-center gap-4">
      <div class="flex gap-4">
        <Anchor class="w-32 text-center" button accent on:click={autoLogIn}>Log In</Anchor>
        <Anchor class="w-32 text-center" button on:click={signUp}>Sign Up</Anchor>
      </div>
      <Anchor on:click={advancedLogIn}>
        <i class="fa fa-cogs" /> Advanced Login
      </Anchor>
    </div>
  </div>
</Content>
