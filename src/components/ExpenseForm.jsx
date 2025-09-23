import React, { useState } from 'react'
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
      payerUid: currentUser.uid,
      split: [
        { uidOrEmail: currentUser.uid, ratio: Number(yourRatio) },
        { uidOrEmail: partnerEmail, ratio: Number((1 - yourRatio).toFixed(4)) }
      ],
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    await addDoc(collection(db,'expenses'), doc)
    setDescription(''); setAmount('')
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="row">
        <div>
          <label>Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div>
          <label>Description</label>
          <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Groceries" />
        </div>
      </div>
      <div className="row">
        <div>
          <label>Category</label>
          <input value={category} onChange={e=>setCategory(e.target.value)} placeholder="e.g. Market" />
        </div>
        <div>
          <label>Cost center</label>
          <select value={costCenter} onChange={e=>setCostCenter(e.target.value)}>
            <option>Shared</option>
            <option>Juan</option>
            <option>Maruja</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label>Amount</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} />
        </div>
        <div>
          <label>Conciliado</label>
          <select value={conciliado ? 'yes' : 'no'} onChange={e=>setConciliado(e.target.value==='yes')}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div>
          <label>Your split ratio ({(yourRatio*100).toFixed(0)}%)</label>
          <input type="range" min="0" max="1" step="0.05" value={yourRatio} onChange={e=>setYourRatio(Number(e.target.value))} />
          <div className="small">Partner will get {(100 - yourRatio*100).toFixed(0)}%</div>
        </div>
      </div>
      <div className="flex" style={{gap:8}}>
        <button type="submit">Add</button>
      </div>
    </form>
  )
}
