import React from 'react'
import { formatCurrency, formatSignedCurrency } from '../lib/currency'

export default function CurrencyValue({
  value,
  signed = false,
  className = '',
  positiveClass = 'text-emerald-600',
  negativeClass = 'text-rose-600',
  zeroClass = 'text-slate-500'
}){
  const numeric = Number(value)
  const isInvalid = Number.isNaN(numeric)
  const displayValue = signed
    ? formatSignedCurrency(isInvalid ? 0 : numeric)
    : formatCurrency(isInvalid ? 0 : numeric)

  let toneClass = ''
  if (signed) {
    toneClass = numeric > 0
      ? positiveClass
      : numeric < 0
        ? negativeClass
        : zeroClass
  }

  const classes = [className, toneClass].filter(Boolean).join(' ').trim()

  return (
    <span className={classes || undefined}>{displayValue}</span>
  )
}
