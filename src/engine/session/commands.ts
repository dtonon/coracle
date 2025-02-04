import {omit, assoc} from "ramda"
import {generatePrivateKey, getPublicKey, appDataKeys} from "src/util/nostr"
import {createAndPublish} from "src/engine/network/utils"
import {people} from "src/engine/people/state"
import type {Session} from "./model"
import {sessions, pubkey} from "./state"
import {canSign, nip04, session} from "./derived"

const addSession = (s: Session) => {
  sessions.update(assoc(s.pubkey, s))
  people.key(s.pubkey).update($p => ({...$p, pubkey: s.pubkey}))
  pubkey.set(s.pubkey)
}

export const loginWithPrivateKey = privkey =>
  addSession({method: "privkey", pubkey: getPublicKey(privkey), privkey})

export const loginWithPublicKey = pubkey => addSession({method: "pubkey", pubkey})

export const loginWithExtension = pubkey => addSession({method: "extension", pubkey})

export const loginWithNsecBunker = (pubkey, bunkerToken, bunkerRelay) =>
  addSession({method: "bunker", pubkey, bunkerKey: generatePrivateKey(), bunkerToken, bunkerRelay})

export const logoutPubkey = pubkey => {
  if (session.get().pubkey === pubkey) {
    throw new Error("Can't destroy the current session, use logout instead")
  }

  sessions.update(omit([pubkey]))
}

export const logout = () => {
  pubkey.set(null)
  sessions.set({})
}

export const setAppData = async (d: string, data: any) => {
  if (canSign.get()) {
    const {pubkey} = session.get()
    const json = JSON.stringify(data)
    const content = await nip04.get().encryptAsUser(json, pubkey)

    return createAndPublish(30078, {content, tags: [["d", d]]})
  }
}

export const publishSettings = async (updates: Record<string, any>) => {
  setAppData(appDataKeys.USER_SETTINGS, {
    ...session.get().settings,
    ...updates,
  })
}

export const updateSession = (k, f) => sessions.update($s => ({...$s, [k]: f($s[k])}))

export const updateCurrentSession = f => {
  const $pubkey = pubkey.get()

  if ($pubkey) {
    updateSession($pubkey, f)
  }
}
