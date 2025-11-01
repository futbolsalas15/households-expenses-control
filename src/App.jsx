import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { db } from './firebase'
import {
  collection, doc, onSnapshot, orderBy, query, updateDoc, where
} from 'firebase/firestore'
import ExpenseForm from './components/ExpenseForm'
import ExpenseTable from './components/ExpenseTable'
import CurrencyValue from './components/CurrencyValue'
import { computeBalances } from './lib/calc'
import {
  emailHouseholdId,
  legacyHouseholdId,
  normalizeMemberKey,
  memberKeysForUser,
  buildMemberKeySet
} from './lib/identity'
import { formatCurrency } from './lib/currency'

export default function App(){
  const { user, loading, loginWithGoogle, logout } = useAuth()
  const [partnerEmail, setPartnerEmail] = useState('')
  const [showConciliado, setShowConciliado] = useState(false)
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
    return expenses.filter(e=>{
      if(!showConciliado && e.conciliado) return false
      if(search && !(`${e.description} ${e.category}`.toLowerCase().includes(search.toLowerCase()))) return false
      return true
    })
  }, [expenses, showConciliado, search])

  const youKeys = useMemo(() => memberKeysForUser(user), [user?.uid, user?.email])
  const partnerKeys = useMemo(
    () => buildMemberKeySet(partnerEmail),
    [partnerEmail]
  )

  const balanceSource = useMemo(() => filtered.filter(e => !e.conciliado), [filtered])

  const balances = useMemo(()=>{
    if(!user) return {you:{gasto:0,aporto:0,balance:0}, partner:{gasto:0,aporto:0,balance:0}}
    return computeBalances(balanceSource, youKeys, partnerKeys)
  }, [balanceSource, user, youKeys, partnerKeys])

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

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
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
                <h3 className="text-lg font-semibold text-slate-900">Balances (all time)</h3>
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
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4">
                        <span>Gasto</span>
                        <CurrencyValue value={balances.you.gasto} className="block text-right font-semibold text-slate-900 tabular-nums" />
                      </div>
                      <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4">
                        <span>Aporto</span>
                        <CurrencyValue value={balances.you.aporto} className="block text-right font-semibold text-slate-900 tabular-nums" />
                      </div>
                      <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4">
                        <span>Balance</span>
                        <CurrencyValue value={balances.you.balance} signed className="block text-right font-semibold tabular-nums" />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Partner</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4">
                        <span>Gasto</span>
                        <CurrencyValue value={balances.partner.gasto} className="block text-right font-semibold text-slate-900 tabular-nums" />
                      </div>
                      <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4">
                        <span>Aporto</span>
                        <CurrencyValue value={balances.partner.aporto} className="block text-right font-semibold text-slate-900 tabular-nums" />
                      </div>
                      <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4">
                        <span>Balance</span>
                        <CurrencyValue value={balances.partner.balance} signed className="block text-right font-semibold tabular-nums" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-slate-600">
                  {balances.you.balance > 0 ? (
                    <span>
                      Partner owes you{' '}
                      <CurrencyValue
                        value={balances.you.balance}
                        signed
                        className="font-semibold tabular-nums"
                      />
                    </span>
                  ) : balances.you.balance < 0 ? (
                    <span>
                      You owe partner{' '}
                      <CurrencyValue
                        value={balances.you.balance}
                        signed
                        className="font-semibold tabular-nums"
                      />
                    </span>
                  ) : 'Even ✔︎'}
                </div>
                <div className="mt-4 text-sm text-slate-500">Search expenses below to refine the table view.</div>
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
            <div className="mt-4 flex items-center gap-3 text-sm text-slate-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showConciliado}
                  onChange={()=>setShowConciliado(prev=>!prev)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Include conciliado
              </label>
            </div>
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
