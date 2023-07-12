import {nip19, getPublicKey, getSignature, generatePrivateKey} from "nostr-tools"
import NDK, {NDKEvent, NDKNip46Signer, NDKPrivateKeySigner} from "@nostr-dev-kit/ndk"
import {switcherFn} from "hurdak/lib/hurdak"
import {writable, collection, derived} from "../util/store"

export type LoginMethod = "bunker" | "pubkey" | "privkey" | "extension"

export type KeyState = {
  method: LoginMethod
  pubkey: string
  privkey: string | null
  bunkerKey: string | null
}

export class Keys {
  static contributeState() {
    const pubkey = writable<string | null>()

    const state = collection<KeyState>()

    const current = derived<KeyState | null>([pubkey, state], ([k, m]) => state.getKey(k))

    const canSign = derived(current, keyState =>
      ["bunker", "privkey", "extension"].includes(keyState?.method)
    )

    return {pubkey, state, current, canSign}
  }

  static contributeSelectors({Keys}) {
    const {current} = Keys

    let extensionLock = Promise.resolve()

    const getExtension = () => (window as {nostr?: any}).nostr

    const withExtension = f => {
      extensionLock = extensionLock.catch(e => console.error(e)).then(() => f(getExtension()))

      return extensionLock
    }

    const isKeyValid = key => {
      // Validate the key before setting it to state by encoding it using bech32.
      // This will error if invalid (this works whether it's a public or a private key)
      try {
        nip19.npubEncode(key)
      } catch (e) {
        return false
      }

      return true
    }

    const ndkInstances = new Map()

    const prepareNDK = async (token?: string) => {
      const {pubkey, bunkerKey} = current.get()
      const localSigner = new NDKPrivateKeySigner(bunkerKey)

      const ndk = new NDK({
        explicitRelayUrls: [
          "wss://relay.f7z.io",
          "wss://relay.damus.io",
          "wss://relay.nsecbunker.com",
        ],
      })

      ndk.signer = Object.assign(new NDKNip46Signer(ndk, pubkey, localSigner), {token})

      await ndk.connect(5000)
      await ndk.signer.blockUntilReady()

      ndkInstances.set(pubkey, ndk)
    }

    const getNDK = async () => {
      const {pubkey} = current.get()

      if (!ndkInstances.has(pubkey)) {
        await prepareNDK()
      }

      return ndkInstances.get(pubkey)
    }

    return {withExtension, isKeyValid, getNDK}
  }

  static contributeActions({Keys}) {
    const {pubkey, state, current, withExtension, getNDK} = Keys

    const login = (method, key) => {
      let pubkey = null
      let privkey = null
      let bunkerKey = null

      if (method === "privkey") {
        privkey = key
        pubkey = getPublicKey(key)
      } else if (["pubkey", "extension"].includes(method)) {
        pubkey = key
      } else if (method === "bunker") {
        pubkey = key.pubkey
        bunkerKey = generatePrivateKey()

        getNDK(key.token)
      }

      state.key(pubkey).set({method, pubkey, privkey, bunkerKey})
      pubkey.set(pubkey)
    }

    const sign = async event => {
      const {method, privkey} = current.get()

      console.assert(event.id)
      console.assert(event.pubkey)
      console.assert(event.created_at)

      return switcherFn(method, {
        bunker: async () => {
          const ndk = await getNDK()
          const ndkEvent = new NDKEvent(ndk, event)

          await ndkEvent.sign(ndk.signer)

          return ndkEvent.rawEvent()
        },
        privkey: () => {
          return Object.assign(event, {
            sig: getSignature(event, privkey),
          })
        },
        extension: () => withExtension(ext => ext.signEvent(event)),
      })
    }

    const clear = () => {
      const $pubkey = pubkey.get()

      pubkey.set(null)
      state.key($pubkey).remove()
    }

    return {login, sign, clear}
  }
}
