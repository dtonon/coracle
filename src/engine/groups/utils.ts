import {prop, uniqBy, defaultTo, sortBy, last, whereEq} from "ramda"
import {ellipsize, first, seconds} from "hurdak"
import {Tags} from "paravel"
import {Naddr} from "src/util/nostr"
import type {GroupStatus} from "src/engine/session/model"
import {pubkey} from "src/engine/session/state"
import {session} from "src/engine/session/derived"
import {getUserRelayUrls, getGroupHints, mergeHints} from "src/engine/relays/utils"
import {groups, groupSharedKeys, groupAdminKeys} from "./state"
import {GroupAccess} from "./model"
import type {Group} from "./model"

export const getGroupNaddr = (group: Group) =>
  Naddr.fromTagValue(group.address, group.relays).encode()

export const getGroupId = (group: Group) => group.address.split(":").slice(2).join(":")

export const getGroupName = (group: Group) => group.meta?.name || group.id

export const displayGroup = (group: Group) => ellipsize(group ? getGroupName(group) : "No name", 60)

export const deriveGroup = address => {
  const {identifier, pubkey} = Naddr.fromTagValue(address)

  return groups.key(address).derived(defaultTo({id: identifier, pubkey, address}))
}

export const getRecipientKey = wrap => {
  const pubkey = Tags.from(wrap).pubkeys().first()
  const sharedKey = groupSharedKeys.key(pubkey).get()

  if (sharedKey) {
    return sharedKey.privkey
  }

  const adminKey = groupAdminKeys.key(pubkey).get()

  if (adminKey) {
    return adminKey.privkey
  }

  return null
}

export const getGroupReqInfo = (address = null) => {
  let since = session.get()?.groups_last_synced || 0
  let $groupSharedKeys = groupSharedKeys.get()
  let $groupAdminKeys = groupAdminKeys.get()

  if (address) {
    since = session.get()?.groups?.[address]?.last_synced || 0
    $groupSharedKeys = $groupSharedKeys.filter(whereEq({group: address}))
    $groupAdminKeys = $groupAdminKeys.filter(whereEq({group: address}))
  }

  // Account for timestamp randomization
  since = Math.max(0, since - seconds(7, "day"))

  const admins = []
  const addresses = []
  const recipients = [pubkey.get()]

  for (const key of [...$groupSharedKeys, ...$groupAdminKeys]) {
    admins.push(Naddr.fromTagValue(key.group).pubkey)
    addresses.push(key.group)
    recipients.push(key.pubkey)
  }

  const relays = mergeHints([getUserRelayUrls("read"), ...addresses.map(getGroupHints)])

  return {admins, recipients, relays, since}
}

export const deriveSharedKeyForGroup = (address: string) =>
  groupSharedKeys.derived($keys =>
    last(sortBy(prop("created_at"), $keys.filter(whereEq({group: address})))),
  )

export const deriveAdminKeyForGroup = (address: string) => groupAdminKeys.key(address.split(":")[1])

export const deriveGroupStatus = address =>
  session.derived($session => ($session?.groups?.[address] || {}) as GroupStatus)

export const deriveIsGroupMember = address =>
  deriveGroupStatus(address).derived(s => {
    if (address.startsWith("34550:")) {
      return s.joined
    }

    if (address.startsWith("35834:")) {
      return s.access === GroupAccess.Granted
    }
  })

export const deriveGroupOptions = defaultGroups =>
  session.derived($session => {
    const options = []

    for (const address of Object.keys($session?.groups || {})) {
      const group = groups.key(address).get()

      if (group && deriveIsGroupMember(address).get()) {
        options.push(group)
      }
    }

    for (const address of defaultGroups) {
      options.push({address})
    }

    return uniqBy(prop("address"), options)
  })

export const deriveUserCommunities = () =>
  session.derived($session => {
    return Object.entries($session.groups)
      .filter(([a, s]) => s.joined && a.startsWith("34550:"))
      .map(first)
  })
