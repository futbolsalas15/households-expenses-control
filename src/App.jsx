import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { db } from './firebase'
import {
  collection, doc, onSnapshot, orderBy, query, updateDoc, where
} from 'firebase/firestore'
import ExpenseForm from './components/ExpenseForm'
import ExpenseTable from './components/ExpenseTable'
import { computeBalances } from './lib/calc'
import {
  emailHouseholdId,
  legacyHouseholdId,
  normalizeMemberKey,
  memberKeysForUser,
  buildMemberKeySet
} from './lib/identity'

export default function App(){
  const { user, loading, loginWithGoogle, logout } = useAuth()
  const [partnerEmail, setPartnerEmail] = useState('')
  const [onlyThisMonth, setOnlyThisMonth] = useState(false)
  const [conciliadoFilter, setConciliadoFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expenses, setExpenses] = useState([])
  const [editingExpense, setEditingExpense] = useState(null)
  const [collapsedSections, setCollapsedSections] = useState({
    header: true,
    form: true,
    balances: true,
    expenses: false
  })
  const migratedIdsRef = useRef(new Set())

  function toggleSection(key){
    setCollapsedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  useEffect(()=>{
    if(!user) return
    const fallback = user.email === 'futbolsalas15@gmail.com'
      ? 'royalelminya@gmail.com'
      : user.email === 'royalelminya@gmail.com'
        ? 'futbolsalas15@gmail.com'
        : 'cousin@example.com'
    const stored = localStorage.getItem('partnerEmail')
    const next = stored || fallback
    setPartnerEmail(next)
  }, [user])

  useEffect(()=>{
    if(!user || !partnerEmail) return
    localStorage.setItem('partnerEmail', partnerEmail)
  }, [partnerEmail, user])

  useEffect(()=>{
    if(!user) return
    const normalizedPartner = normalizeMemberKey(partnerEmail)
    if(!normalizedPartner) return

    const emailBasedId = emailHouseholdId(user.email, partnerEmail)
    const legacyId = legacyHouseholdId(user.uid, partnerEmail)
    const ids = Array.from(new Set([emailBasedId, legacyId].filter(Boolean)))
    if(ids.length === 0) return

    const col = collection(db, 'expenses')
    const householdConstraint = ids.length === 1
      ? where('householdId', '==', ids[0])
      : where('householdId', 'in', ids)
    const q = query(col, householdConstraint, orderBy('date','desc'))
    const unsub = onSnapshot(q, snap => {
      const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }))
      setExpenses(rows)
    })
    return () => unsub()
  }, [user?.uid, user?.email, partnerEmail])

  useEffect(()=>{
    if(!user) return
    const normalizedPartner = normalizeMemberKey(partnerEmail)
    if(!normalizedPartner) return

    const emailBasedId = emailHouseholdId(user.email, partnerEmail)
    const legacyId = legacyHouseholdId(user.uid, partnerEmail)
    if(!emailBasedId || !legacyId || emailBasedId === legacyId) return

    const toMigrate = expenses.filter(e => e.householdId === legacyId)
    if(!toMigrate.length) return

    for(const exp of toMigrate){
      if(migratedIdsRef.current.has(exp.id)) continue
      migratedIdsRef.current.add(exp.id)
      updateDoc(doc(db, 'expenses', exp.id), { householdId: emailBasedId }).catch(()=>{
        migratedIdsRef.current.delete(exp.id)
      })
    }
  }, [expenses, user?.uid, user?.email, partnerEmail])

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

  const youKeys = useMemo(() => memberKeysForUser(user), [user?.uid, user?.email])
  const partnerKeys = useMemo(
    () => buildMemberKeySet(partnerEmail),
    [partnerEmail]
  )

  const balances = useMemo(()=>{
    if(!user) return {you:{gasto:0,aporto:0,balance:0}, partner:{gasto:0,aporto:0,balance:0}}
    return computeBalances(filtered, youKeys, partnerKeys)
  }, [filtered, user, youKeys, partnerKeys])

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
          <button
            type="button"
            onClick={()=>toggleSection('header')}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700 sm:hidden"
          >
            <span>Household info</span>
            <span>{collapsedSections.header ? 'Show' : 'Hide'}</span>
          </button>
          <div className={`${collapsedSections.header ? 'hidden' : 'block'} sm:block sm:flex sm:flex-col sm:gap-4 md:flex-row md:items-center md:justify-between`}>
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold text-slate-900">Hi, {user.displayName?.split(' ')[0] || user.email}</p>
              <span className="text-sm text-slate-500">{user.email}</span>
            </div>
            <div className="flex flex-col gap-1 sm:items-end">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Partner email</span>
              <span className="rounded-xl border border-transparent bg-slate-100 px-3 py-2 text-sm text-slate-700 sm:min-w-[16rem]">
                {partnerEmail}
              </span>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Add expense</h3>
              <button
                type="button"
                className="text-sm font-medium text-indigo-600 sm:hidden"
                onClick={()=>toggleSection('form')}
              >
                {collapsedSections.form ? 'Show form' : 'Hide form'}
              </button>
            </div>
            <div className={`${collapsedSections.form ? 'hidden' : 'block'} sm:block`}>
              <ExpenseForm
                currentUser={user}
                partnerEmail={partnerEmail}
                editingExpense={editingExpense}
                onCancelEdit={()=>setEditingExpense(null)}
                onSubmitComplete={()=>setEditingExpense(null)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Balances {onlyThisMonth ? '(this month)' : '(all time)'}</h3>
                <button
                  type="button"
                  className="text-sm font-medium text-indigo-600 sm:hidden"
                  onClick={()=>toggleSection('balances')}
                >
                  {collapsedSections.balances ? 'Show' : 'Hide'}
                </button>
              </div>
              <div className={`${collapsedSections.balances ? 'hidden' : 'block'} sm:block`}>
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
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Expenses</h3>
            <button
              type="button"
              className="text-sm font-medium text-indigo-600 sm:hidden"
              onClick={()=>toggleSection('expenses')}
            >
              {collapsedSections.expenses ? 'Show' : 'Hide'}
            </button>
          </div>
          <div className={`${collapsedSections.expenses ? 'hidden' : 'block'} sm:block`}>
            <div className="mt-4 overflow-x-auto">
              <ExpenseTable
                rows={filtered}
                currentUser={user}
                onEdit={expense=>setEditingExpense(expense)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
