import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { db } from './firebase'
import {
  addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where
} from 'firebase/firestore'
import ExpenseForm from './components/ExpenseForm'
import ExpenseTable from './components/ExpenseTable'
import { computeBalances } from './lib/calc'

function stableHouseholdId(uid, partnerEmail){
  const a = uid || ''
  const b = (partnerEmail || '').toLowerCase().trim()
  return [a,b].sort().join('__')
}

export default function App(){
  const { user, loading, loginWithGoogle, logout } = useAuth()
  const [partnerEmail, setPartnerEmail] = useState(localStorage.getItem('partnerEmail') || 'cousin@example.com')
  const [onlyThisMonth, setOnlyThisMonth] = useState(true)
  const [conciliadoFilter, setConciliadoFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expenses, setExpenses] = useState([])

  useEffect(()=>{
    localStorage.setItem('partnerEmail', partnerEmail)
  }, [partnerEmail])

  useEffect(()=>{
    if(!user) return
    const householdId = stableHouseholdId(user.uid, partnerEmail)
    const col = collection(db, 'expenses')
    const constraints = [ where('householdId','==',householdId), orderBy('date','desc') ]
    const q = query(col, ...constraints)
    const unsub = onSnapshot(q, snap => {
      const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }))
      setExpenses(rows)
    })
    return () => unsub()
  }, [user, partnerEmail])

  const filtered = useMemo(()=>{
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const startOfMonth = new Date(year, month, 1).toISOString().slice(0,10)
    return expenses.filter(e=>{
      if(onlyThisMonth && e.date < startOfMonth) return false
      if(conciliadoFilter==='yes' && !e.conciliado) return false
      if(conciliadoFilter==='no' && e.conciliado) return false
      if(search && !(`${e.description} ${e.category}`.toLowerCase().includes(search.toLowerCase()))) return false
      return true
    })
  }, [expenses, onlyThisMonth, conciliadoFilter, search])

  const balances = useMemo(()=>{
    if(!user) return {you:{gasto:0,aporto:0,balance:0}, partner:{gasto:0,aporto:0,balance:0}}
    return computeBalances(filtered, user.uid, partnerEmail)
  }, [filtered, user, partnerEmail])

  async function quickAddDemo(){
    if(!user) return
    const householdId = stableHouseholdId(user.uid, partnerEmail)
    await addDoc(collection(db,'expenses'), {
      householdId,
      date: new Date().toISOString().slice(0,10),
      weekLabel: 'demo',
      description: 'Pan y leche',
      category: 'Mercado',
      costCenter: 'Shared',
      amount: 25000,
      conciliado: false,
      payerUid: user.uid,
      split: [
        { uidOrEmail: user.uid, ratio: 0.5 },
        { uidOrEmail: partnerEmail, ratio: 0.5 }
      ],
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  }

  if(loading) return <div className="container"><div className="card">Loading…</div></div>

  if(!user){
    return (
      <div className="container">
        <div className="card">
          <h2>Household Expenses</h2>
          <p className="small">Sign in to start</p>
          <button onClick={loginWithGoogle}>Sign in with Google</button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <div className="flex justify-between stack-on-mobile">
          <div className="flex user-info" style={{gap:16}}>
            <div><strong>Hi, {user.displayName?.split(' ')[0]}</strong></div>
            <div className="small">({user.email})</div>
          </div>
          <div className="flex header-actions" style={{gap:8}}>
            <input
              className="filter-control"
              placeholder="Partner email"
              value={partnerEmail}
              onChange={e=>setPartnerEmail(e.target.value)}
            />
            <button onClick={logout}>Logout</button>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="card" style={{flex:2}}>
          <h3 className="flex justify-between">
            <span>Add expense</span>
            <button onClick={quickAddDemo} title="Insert a demo expense">Demo</button>
          </h3>
          <ExpenseForm currentUser={user} partnerEmail={partnerEmail} />
        </div>
        <div className="card" style={{flex:1}}>
          <h3>Balances {onlyThisMonth ? '(this month)' : '(all time)'}</h3>
          <div className="row">
            <div className="card" style={{flex:1, margin:0}}>
              <div className="small">You</div>
              <div>Gasto: ${balances.you.gasto.toFixed(0)}</div>
              <div>Aporto: ${balances.you.aporto.toFixed(0)}</div>
              <div><strong>Balance: ${balances.you.balance.toFixed(0)}</strong></div>
            </div>
            <div className="card" style={{flex:1, margin:0}}>
              <div className="small">Partner</div>
              <div>Gasto: ${balances.partner.gasto.toFixed(0)}</div>
              <div>Aporto: ${balances.partner.aporto.toFixed(0)}</div>
              <div><strong>Balance: ${balances.partner.balance.toFixed(0)}</strong></div>
            </div>
          </div>
          <div className="small" style={{marginTop:8}}>
            {balances.you.balance > 0
              ? `Partner owes you $${balances.you.balance.toFixed(0)}`
              : balances.you.balance < 0
                ? `You owe partner $${Math.abs(balances.you.balance).toFixed(0)}`
                : 'Even ✔︎'}
          </div>
          <div className="flex filter-bar">
            <label className="filter-checkbox"><input type="checkbox" checked={onlyThisMonth} onChange={()=>setOnlyThisMonth(v=>!v)} /> Only this month</label>
            <select className="filter-control" value={conciliadoFilter} onChange={e=>setConciliadoFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="yes">Conciliado</option>
              <option value="no">Pending</option>
            </select>
            <input
              className="filter-control"
              placeholder="Search description/category"
              value={search}
              onChange={e=>setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Expenses</h3>
        <div className="table-responsive">
          <ExpenseTable rows={filtered} currentUser={user} />
        </div>
      </div>
    </div>
  )
}
