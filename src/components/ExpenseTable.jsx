import React from 'react'

export default function ExpenseTable({ rows, currentUser }){
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th>Cost center</th>
          <th>Payer</th>
          <th>Amount</th>
          <th>Conciliado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td>{r.date}</td>
            <td>{r.description}</td>
            <td>{r.category}</td>
            <td><span className="badge">{r.costCenter}</span></td>
            <td>{r.payerUid===currentUser.uid ? 'You' : 'Partner'}</td>
            <td>${r.amount?.toLocaleString?.() ?? r.amount}</td>
            <td>{r.conciliado ? 'Yes' : 'No'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
