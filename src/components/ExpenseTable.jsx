import React from 'react'
import { deleteDoc, doc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { memberKeysForUser, normalizeMemberKey } from '../lib/identity'

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
})

function formatCurrency(value){
  const numeric = Number(value)
  if(Number.isNaN(numeric)) return '$0'
  return currencyFormatter.format(numeric)
}

function formatSignedCurrency(value){
  if(value == null || Number.isNaN(value) || value === 0) return '$0'
  const abs = Math.abs(value)
  const prefix = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${prefix}${formatCurrency(abs)}`
}

function computeNetForUser(expense, yourKeys){
  const amount = Number(expense.amount || 0)
  const split = Array.isArray(expense.split) ? expense.split : []

  let shareRatio = 0
  let totalRatio = 0
  for (const entry of split) {
    const ratio = Number(entry?.ratio ?? 0)
    if (!ratio) continue
    totalRatio += ratio
    const key = normalizeMemberKey(entry?.uidOrEmail)
    if (yourKeys.has(key)) {
      shareRatio += ratio
    }
  }

  if (totalRatio > 0) {
    shareRatio = Math.min(1, shareRatio / totalRatio)
  } else {
    shareRatio = 0.5
  }

  const yourShare = amount * Number(shareRatio ?? 0)
  const paidByYou = yourKeys.has(normalizeMemberKey(expense.payerUid)) ? amount : 0
  return paidByYou - yourShare
}

export default function ExpenseTable({ rows, currentUser, onEdit }){
  const yourKeys = memberKeysForUser(currentUser)
  const [selectedIds, setSelectedIds] = React.useState(()=>new Set())

  React.useEffect(() => {
    setSelectedIds(prev => {
      if (prev.size === 0) return prev
      const validIds = new Set(rows.map(r => r.id))
      let changed = false
      const next = new Set()
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      }
      if (!changed && next.size === prev.size) return prev
      return next
    })
  }, [rows])

  const selectedCount = selectedIds.size
  const allSelected = rows.length > 0 && selectedCount === rows.length

  function toggleSelect(id){
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAll(){
    setSelectedIds(prev => {
      if (allSelected) return new Set()
      const next = new Set(rows.map(r => r.id))
      return next
    })
  }

  async function handleDelete(id){
    const confirmDelete = window.confirm('Delete this expense? This cannot be undone.')
    if(!confirmDelete) return
    setSelectedIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    await deleteDoc(doc(db, 'expenses', id))
  }

  async function handleBulkConciliate(){
    if (selectedIds.size === 0) return
    const batch = writeBatch(db)
    for (const id of selectedIds) {
      batch.update(doc(db, 'expenses', id), { conciliado: true })
    }
    await batch.commit()
    setSelectedIds(new Set())
  }

  async function handleBulkDelete(){
    if (selectedIds.size === 0) return
    const confirmDelete = window.confirm(`Delete ${selectedIds.size} expense(s)? This cannot be undone.`)
    if(!confirmDelete) return
    const batch = writeBatch(db)
    for (const id of selectedIds) {
      batch.delete(doc(db, 'expenses', id))
    }
    await batch.commit()
    setSelectedIds(new Set())
  }

  return (
    <div className="space-y-4">
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm font-semibold text-slate-700">{selectedCount} selected</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleBulkConciliate}
              className="inline-flex items-center rounded-lg border border-transparent bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
            >
              Mark as conciliado
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex items-center rounded-lg border border-transparent bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}
      <div className="hidden sm:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-3 pr-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th scope="col" className="py-3 pr-4">Date</th>
              <th scope="col" className="py-3 pr-4">Description</th>
              <th scope="col" className="py-3 pr-4">Category</th>
              <th scope="col" className="py-3 pr-4">Cost center</th>
              <th scope="col" className="py-3 pr-4">Payer</th>
              <th scope="col" className="py-3 pr-4">Amount</th>
              <th scope="col" className="py-3 pr-4 text-right">Net (you)</th>
              <th scope="col" className="py-3 pr-4">Conciliado</th>
              <th scope="col" className="py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map(r => {
              const netAmount = computeNetForUser(r, yourKeys)
              const netClass = netAmount > 0
                ? 'text-emerald-600'
                : netAmount < 0
                  ? 'text-rose-600'
                  : 'text-slate-500'
              const isSelected = selectedIds.has(r.id)
              return (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="py-3 pr-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(r.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{r.date}</td>
                  <td className="py-3 pr-4 font-medium text-slate-900">{r.description}</td>
                  <td className="py-3 pr-4 text-slate-600">{r.category || '—'}</td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
                      {r.costCenter || '—'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{yourKeys.has(normalizeMemberKey(r.payerUid)) ? 'You' : r.payerUid || '—'}</td>
                  <td className="whitespace-nowrap py-3 pr-4 font-medium text-slate-900">
                    {formatCurrency(Number(r.amount || 0))}
                  </td>
                  <td className={`whitespace-nowrap py-3 pr-4 text-right font-semibold ${netClass}`}>
                    {formatSignedCurrency(netAmount)}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{r.conciliado ? 'Yes' : 'No'}</td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={()=>onEdit?.(r)}
                        className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={()=>handleDelete(r.id)}
                        className="inline-flex items-center rounded-lg border border-transparent px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        {rows.map(r => {
          const netAmount = computeNetForUser(r, yourKeys)
          const netClass = netAmount > 0
            ? 'text-emerald-600'
            : netAmount < 0
              ? 'text-rose-600'
              : 'text-slate-500'
          const netLabel = netAmount > 0
            ? 'Partner owes you'
            : netAmount < 0
              ? 'You owe partner'
              : 'Even'
          const isSelected = selectedIds.has(r.id)
          return (
            <details key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <div className="flex flex-1 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleSelect(r.id)
                    }}
                    onClick={e => e.stopPropagation()}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{r.description}</p>
                    <span className="mt-1 block text-xs text-slate-500">{r.date}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-sm font-semibold ${netClass}`}>
                    {formatSignedCurrency(netAmount)}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">{netLabel}</span>
                </div>
              </summary>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Amount</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(Number(r.amount || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Category</span>
                  <span>{r.category || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Cost center</span>
                  <span>{r.costCenter || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Payer</span>
                  <span>{yourKeys.has(normalizeMemberKey(r.payerUid)) ? 'You' : r.payerUid || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Conciliado</span>
                  <span>{r.conciliado ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className="font-medium text-slate-500">Split</span>
                  <div className="mt-2 space-y-1">
                    {(Array.isArray(r.split) ? r.split : []).map((s, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-500">
                        <span>{s.uidOrEmail}</span>
                        <span>{Math.round((Number(s.ratio ?? 0) || 0) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={()=>onEdit?.(r)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={()=>handleDelete(r.id)}
                    className="flex-1 rounded-lg border border-transparent bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
