import React, { useEffect, useRef, useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { weekLabelFromISO } from '../lib/calc'

function householdId(uid, partnerEmail){
  return [uid, (partnerEmail||'').toLowerCase().trim()].sort().join('__')
}

export default function ExpenseForm({ currentUser, partnerEmail }){
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('General')
  const [costCenter, setCostCenter] = useState('Shared')
  const [amount, setAmount] = useState('')
  const [conciliado, setConciliado] = useState(false)
  const [yourRatio, setYourRatio] = useState(0.5)
  const [payer, setPayer] = useState(currentUser.uid)
  const previousPartnerRef = useRef(partnerEmail)

  useEffect(()=>{
    setPayer(currentUser.uid)
  }, [currentUser.uid])

  useEffect(()=>{
    setPayer(prev => {
      if(prev === previousPartnerRef.current){
        return partnerEmail || currentUser.uid
      }
      return prev
    })
    previousPartnerRef.current = partnerEmail
  }, [partnerEmail, currentUser.uid])

  async function onSubmit(e){
    e.preventDefault()
    if(!amount || !description) return
    const doc = {
      householdId: householdId(currentUser.uid, partnerEmail),
      date,
      weekLabel: weekLabelFromISO(date),
      description, category, costCenter,
      amount: Number(amount),
      conciliado,
      payerUid: payer,
      split: [
        { uidOrEmail: currentUser.uid, ratio: Number(yourRatio) },
        { uidOrEmail: partnerEmail, ratio: Number((1 - yourRatio).toFixed(4)) }
      ],
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    await addDoc(collection(db,'expenses'), doc)
    setDescription(''); setAmount(''); setPayer(currentUser.uid)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</label>
          <input
            type="date"
            value={date}
            onChange={e=>setDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
          <input
            value={description}
            onChange={e=>setDescription(e.target.value)}
            placeholder="e.g. Groceries"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
          <input
            value={category}
            onChange={e=>setCategory(e.target.value)}
            placeholder="e.g. Market"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cost center</label>
          <select
            value={costCenter}
            onChange={e=>setCostCenter(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option>Shared</option>
            <option>Juan</option>
            <option>Maruja</option>
            <option>Other</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e=>setAmount(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payer</label>
          <select
            value={payer}
            onChange={e=>setPayer(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value={currentUser.uid}>You ({currentUser.displayName || currentUser.email})</option>
            {partnerEmail && (
              <option value={partnerEmail}>Partner ({partnerEmail})</option>
            )}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conciliado</label>
          <select
            value={conciliado ? 'yes' : 'no'}
            onChange={e=>setConciliado(e.target.value==='yes')}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your split ratio ({(yourRatio*100).toFixed(0)}%)</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={yourRatio}
          onChange={e=>setYourRatio(Number(e.target.value))}
          className="mt-3 w-full accent-indigo-600"
        />
        <div className="mt-2 text-sm text-slate-500">Partner will get {(100 - yourRatio*100).toFixed(0)}%</div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          Add expense
        </button>
      </div>
    </form>
  )
}
