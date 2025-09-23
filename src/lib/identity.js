export function normalizeMemberKey(value) {
  if (!value) return ''
  const trimmed = String(value).trim()
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed
}

export function buildMemberKeySet(...values) {
  const set = new Set()
  for (const value of values) {
    const key = normalizeMemberKey(value)
    if (key) set.add(key)
  }
  return set
}

export function primaryKeyForUser(user) {
  if (!user) return ''
  const emailKey = normalizeMemberKey(user.email)
  if (emailKey) return emailKey
  return normalizeMemberKey(user.uid)
}

export function memberKeysForUser(user) {
  if (!user) return new Set()
  return buildMemberKeySet(user.uid, user.email, primaryKeyForUser(user))
}

export function legacyHouseholdId(primary, secondary) {
  return makeHouseholdId(primary, secondary)
}

export function emailHouseholdId(emailA, emailB) {
  return makeHouseholdId(emailA, emailB)
}

function makeHouseholdId(a, b) {
  const keyA = normalizeMemberKey(a)
  const keyB = normalizeMemberKey(b)
  if (!keyA || !keyB) return ''
  return [keyA, keyB].sort().join('__')
}
