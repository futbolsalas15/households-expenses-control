import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { db } from './firebase'
import {
  collection, onSnapshot, orderBy, query, where
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

  if(loading){
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm">
          Loading…
        </div>
      </div>
    )
  }

  if(!user){
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Household Expenses</h2>
          <p className="mt-2 text-sm text-slate-500">Sign in to start</p>
          <button
            onClick={loginWithGoogle}
            className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold text-slate-900">Hi, {user.displayName?.split(' ')[0]}</p>
              <span className="text-sm text-slate-500">{user.email}</span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:w-64"
                placeholder="Partner email"
                value={partnerEmail}
                onChange={e=>setPartnerEmail(e.target.value)}
              />
              <button
                onClick={logout}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Add expense</h3>
            </div>
            <ExpenseForm currentUser={user} partnerEmail={partnerEmail} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Balances {onlyThisMonth ? '(this month)' : '(all time)'}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">You</div>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    <div>Gasto: ${balances.you.gasto.toFixed(0)}</div>
                    <div>Aporto: ${balances.you.aporto.toFixed(0)}</div>
                    <div className="font-semibold text-slate-900">Balance: ${balances.you.balance.toFixed(0)}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Partner</div>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    <div>Gasto: ${balances.partner.gasto.toFixed(0)}</div>
                    <div>Aporto: ${balances.partner.aporto.toFixed(0)}</div>
                    <div className="font-semibold text-slate-900">Balance: ${balances.partner.balance.toFixed(0)}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-sm text-slate-600">
                {balances.you.balance > 0
                  ? `Partner owes you $${balances.you.balance.toFixed(0)}`
                  : balances.you.balance < 0
                    ? `You owe partner $${Math.abs(balances.you.balance).toFixed(0)}`
                    : 'Even ✔︎'}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="mr-4 flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={onlyThisMonth}
                    onChange={()=>setOnlyThisMonth(prev=>!prev)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Only this month
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:w-44"
                  value={conciliadoFilter}
                  onChange={e=>setConciliadoFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="yes">Conciliado</option>
                  <option value="no">Pending</option>
                </select>
                <input
                  className="w-full flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Search description/category"
                  value={search}
                  onChange={e=>setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Expenses</h3>
          </div>
          <div className="mt-4 overflow-x-auto">
            <ExpenseTable rows={filtered} currentUser={user} />
          </div>
        </div>
      </div>
    </div>
  )
}
