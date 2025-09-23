import { parseISO } from 'date-fns'

export function weekLabelFromISO(dateISO){
  const d = parseISO(dateISO)
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = (d - start) / 86400000
  const week = Math.ceil((diff + start.getDay() + 1) / 7)
  const w = String(week).padStart(2,'0')
  return `${d.getFullYear()}-${w}`
}

export function computeBalances(expenses, youUid, partnerKey){
  let you = { gasto:0, aporto:0 }, partner = { gasto:0, aporto:0 }
  for(const e of expenses){
    const split = e.split || []
    const yourShare = split.find(s => s.uidOrEmail===youUid)?.ratio ?? 0.5
    const partnerShare = split.find(s => s.uidOrEmail===partnerKey)?.ratio ?? (1 - yourShare)

    you.gasto += e.amount * yourShare
    partner.gasto += e.amount * partnerShare

    if(e.payerUid === youUid) you.aporto += e.amount
    if(e.payerUid === partnerKey) partner.aporto += e.amount
  }
  const youBalance = you.aporto - you.gasto
  const partnerBalance = partner.aporto - partner.gasto
  return { you:{...you, balance: youBalance}, partner:{...partner, balance: partnerBalance} }
}
