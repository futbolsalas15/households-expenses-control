import React from 'react'
import { deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'

export default function ExpenseTable({ rows, currentUser }){
  async function handleDelete(id){
    const confirmDelete = window.confirm('Delete this expense? This cannot be undone.')
    if(!confirmDelete) return
    await deleteDoc(doc(db, 'expenses', id))
  }

  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead>
        <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <th scope="col" className="py-3 pr-4">Date</th>
          <th scope="col" className="py-3 pr-4">Description</th>
          <th scope="col" className="py-3 pr-4">Category</th>
          <th scope="col" className="py-3 pr-4">Cost center</th>
          <th scope="col" className="py-3 pr-4">Payer</th>
          <th scope="col" className="py-3 pr-4">Amount</th>
          <th scope="col" className="py-3 pr-4">Conciliado</th>
          <th scope="col" className="py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {rows.map(r => (
          <tr key={r.id} className="hover:bg-slate-50/60">
            <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{r.date}</td>
            <td className="py-3 pr-4 font-medium text-slate-900">{r.description}</td>
            <td className="py-3 pr-4 text-slate-600">{r.category || '—'}</td>
            <td className="py-3 pr-4">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
                {r.costCenter || '—'}
              </span>
            </td>
            <td className="py-3 pr-4 text-slate-600">{r.payerUid===currentUser.uid ? 'You' : r.payerUid || '—'}</td>
            <td className="whitespace-nowrap py-3 pr-4 font-medium text-slate-900">
              ${r.amount?.toLocaleString?.() ?? r.amount}
            </td>
            <td className="py-3 pr-4 text-slate-600">{r.conciliado ? 'Yes' : 'No'}</td>
            <td className="py-3 text-right">
              <button
                type="button"
                onClick={()=>handleDelete(r.id)}
                className="inline-flex items-center rounded-lg border border-transparent px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
