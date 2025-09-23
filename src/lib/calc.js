import { parseISO } from 'date-fns'
import { normalizeMemberKey, buildMemberKeySet } from './identity'

export function weekLabelFromISO(dateISO){
  const d = parseISO(dateISO)
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = (d - start) / 86400000
  const week = Math.ceil((diff + start.getDay() + 1) / 7)
  const w = String(week).padStart(2,'0')
  return `${d.getFullYear()}-${w}`
}

export function computeBalances(expenses, youKeys, partnerKeys){
  const you = { gasto: 0, aporto: 0 }
  const partner = { gasto: 0, aporto: 0 }

  const youKeySet = youKeys instanceof Set ? youKeys : buildMemberKeySet(youKeys)
  const partnerKeySet = partnerKeys instanceof Set
    ? new Set(partnerKeys)
    : buildMemberKeySet(partnerKeys)

  for (const e of expenses) {
    const amount = Number(e.amount || 0)
    if (!amount) continue

    const split = Array.isArray(e.split) ? e.split : []
    let yourShareRatio = 0
    let partnerShareRatio = 0
    let totalRatio = 0

    for (const entry of split) {
      const ratio = Number(entry?.ratio ?? 0)
      if (!ratio) continue
      totalRatio += ratio
      const key = normalizeMemberKey(entry?.uidOrEmail)
      if (youKeySet.has(key)) {
        yourShareRatio += ratio
      } else {
        partnerShareRatio += ratio
        if (key) partnerKeySet.add(key)
      }
    }

    if (totalRatio > 0) {
      yourShareRatio = Math.min(1, yourShareRatio / totalRatio)
      partnerShareRatio = Math.min(1, partnerShareRatio / totalRatio)
      const remainder = Math.max(0, 1 - (yourShareRatio + partnerShareRatio))
      partnerShareRatio = Math.min(1, partnerShareRatio + remainder)
    } else {
      yourShareRatio = 0.5
      partnerShareRatio = 0.5
    }

    const yourShareAmount = amount * yourShareRatio
    const partnerShareAmount = amount * partnerShareRatio

    you.gasto += yourShareAmount
    partner.gasto += partnerShareAmount

    const payerKey = normalizeMemberKey(e.payerUid)
    if (youKeySet.has(payerKey)) {
      you.aporto += amount
    } else if (payerKey) {
      partnerKeySet.add(payerKey)
      partner.aporto += amount
    }
  }

  const youBalance = you.aporto - you.gasto
  const partnerBalance = partner.aporto - partner.gasto
  return {
    you: { ...you, balance: youBalance },
    partner: { ...partner, balance: partnerBalance }
  }
}
