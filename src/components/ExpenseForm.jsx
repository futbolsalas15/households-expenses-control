import React, { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { weekLabelFromISO } from '../lib/calc'
import {
  emailHouseholdId,
  normalizeMemberKey,
  primaryKeyForUser,
  buildMemberKeySet,
  legacyHouseholdId
} from '../lib/identity'

const todayISO = () => new Date().toISOString().slice(0,10)
const CATEGORY_OPTIONS = [
  'Mercado',
  'Viajes',
  'Gastos Personales',
  'Comida Rapida',
  'Servicios'
]

export default function ExpenseForm({ currentUser, partnerEmail, editingExpense, onCancelEdit, onSubmitComplete }){
  const isEditing = Boolean(editingExpense)
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0])
  const [costCenter, setCostCenter] = useState('Shared')
  const [amount, setAmount] = useState('')
  const [conciliado, setConciliado] = useState(false)
  const [yourRatio, setYourRatio] = useState(0.5)
  const yourPrimaryKey = primaryKeyForUser(currentUser)
  const yourKeySet = useMemo(
    () => buildMemberKeySet(currentUser?.uid, currentUser?.email, yourPrimaryKey),
    [currentUser?.uid, currentUser?.email, yourPrimaryKey]
  )
  const yourCostCenterValue = currentUser?.email || yourPrimaryKey
  const partnerCostCenterValue = partnerEmail || ''
  const costCenterOptions = useMemo(() => {
    const options = [{ value: 'Shared', label: 'Shared' }]
    if (yourCostCenterValue) {
      const youLabel = currentUser?.displayName
        ? `You (${currentUser.displayName})`
        : `You (${currentUser?.email || 'You'})`
      options.push({ value: yourCostCenterValue, label: youLabel })
    }
    if (partnerCostCenterValue) {
      options.push({
        value: partnerCostCenterValue,
        label: `Partner (${partnerEmail})`
      })
    }
    return options
  }, [yourCostCenterValue, partnerCostCenterValue, currentUser?.displayName, currentUser?.email, partnerEmail])
  const partnerKey = normalizeMemberKey(partnerEmail)
  const [payer, setPayer] = useState(yourPrimaryKey)
  const previousPartnerRef = useRef(partnerKey)
  const wasEditingRef = useRef(false)

  useEffect(()=>{
    if(isEditing) return
    setPayer(yourPrimaryKey)
  }, [yourPrimaryKey, isEditing])

  useEffect(()=>{
    if(isEditing) return
    setPayer(prev => {
      if(prev === previousPartnerRef.current){
        return partnerKey || yourPrimaryKey
      }
      return prev
    })
    previousPartnerRef.current = partnerKey
  }, [partnerKey, yourPrimaryKey, isEditing])

  useEffect(()=>{
    if(editingExpense){
      wasEditingRef.current = true
      setDate(editingExpense.date || todayISO())
      setDescription(editingExpense.description || '')
      setCategory(editingExpense.category || CATEGORY_OPTIONS[0])
      setCostCenter(editingExpense.costCenter || 'Shared')
      setAmount(
        editingExpense.amount != null
          ? Number(editingExpense.amount).toString()
          : ''
      )
      setConciliado(Boolean(editingExpense.conciliado))
      const split = editingExpense.split || []
      const youShare = split.find(s => yourKeySet.has(normalizeMemberKey(s.uidOrEmail)))?.ratio
      setYourRatio(youShare != null ? Number(youShare) : 0.5)
      const normalizedPayer = normalizeMemberKey(editingExpense.payerUid)
      if (yourKeySet.has(normalizedPayer)) {
        setPayer(yourPrimaryKey)
      } else if (normalizedPayer === partnerKey) {
        setPayer(partnerKey)
      } else {
        setPayer(normalizedPayer || yourPrimaryKey)
      }
      return
    }
    if(wasEditingRef.current){
      wasEditingRef.current = false
      resetForm()
    }
  }, [editingExpense, partnerKey, yourKeySet, yourPrimaryKey])

  useEffect(() => {
    const auto = autoRatioFor(costCenter, payer)
    if (auto == null) return
    setYourRatio(prev => (prev === auto ? prev : auto))
  }, [costCenter, payer, yourPrimaryKey, partnerKey, yourCostCenterValue, partnerCostCenterValue])

  function autoRatioFor(selectedCostCenter, selectedPayer){
    if (!selectedCostCenter) return null
    if (selectedCostCenter === 'Shared') return 0.5
    if (yourCostCenterValue && selectedCostCenter === yourCostCenterValue) {
      if (selectedPayer && selectedPayer !== yourPrimaryKey) return 0
      return 1
    }
    if (partnerCostCenterValue && selectedCostCenter === partnerCostCenterValue) {
      if (selectedPayer === yourPrimaryKey) return 1
      return 0
    }
    return null
  }

  function resetForm(){
    setDate(todayISO())
    setDescription('')
    setCategory(CATEGORY_OPTIONS[0])
    setCostCenter('Shared')
    setAmount('')
    setConciliado(false)
    setYourRatio(0.5)
    setPayer(yourPrimaryKey)
  }

  async function onSubmit(e){
    e.preventDefault()
    if(!amount || !description) return
    const yourRatioNumber = Number(yourRatio)
    const partnerRatio = Number((1 - yourRatioNumber).toFixed(4))
    const split = [
      { uidOrEmail: yourPrimaryKey, ratio: yourRatioNumber }
    ]

    if (partnerKey) {
      split.push({ uidOrEmail: partnerKey, ratio: partnerRatio })
    }

    const base = {
      date,
      weekLabel: weekLabelFromISO(date),
      description,
      category,
      costCenter,
      amount: Number(amount),
      conciliado,
      payerUid: payer,
      split,
      updatedAt: serverTimestamp()
    }

    if(isEditing){
      const ref = doc(db, 'expenses', editingExpense.id)
      await updateDoc(ref, base)
      onSubmitComplete?.()
    } else {
      const payload = {
        householdId: emailHouseholdId(currentUser.email, partnerEmail) || legacyHouseholdIdFallback(),
        createdBy: yourPrimaryKey,
        createdAt: serverTimestamp(),
        ...base
      }
      await addDoc(collection(db,'expenses'), payload)
      resetForm()
    }
  }

  function legacyHouseholdIdFallback(){
    return legacyHouseholdId(currentUser.uid, partnerEmail)
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
          <select
            value={category}
            onChange={e=>setCategory(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {CATEGORY_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
            {!CATEGORY_OPTIONS.includes(category) && (
              <option value={category}>{category}</option>
            )}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cost center</label>
          <select
            value={costCenter}
            onChange={e=>setCostCenter(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {costCenterOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
            {!costCenterOptions.some(option => option.value === costCenter) && costCenter && (
              <option value={costCenter}>{costCenter}</option>
            )}
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
            <option value={yourPrimaryKey || currentUser.uid}>You ({currentUser.displayName || currentUser.email})</option>
            {partnerKey && partnerEmail && (
              <option value={partnerKey}>Partner ({partnerEmail})</option>
            )}
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
          disabled={costCenter === 'Shared'}
          className={`mt-3 w-full accent-indigo-600 ${costCenter === 'Shared' ? 'cursor-not-allowed opacity-60' : ''}`}
        />
        <div className="mt-2 text-sm text-slate-500">Partner will get {(100 - yourRatio*100).toFixed(0)}%</div>
      </div>

      <div className="flex justify-end gap-3">
        {isEditing && (
          <button
            type="button"
            onClick={()=>{
              onCancelEdit?.()
            }}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {isEditing ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </form>
  )
}
