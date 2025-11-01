const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
})

export function formatCurrency(value){
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return '$0'
  return currencyFormatter.format(numeric)
}

export function formatSignedCurrency(value){
  const numeric = Number(value)
  if (Number.isNaN(numeric) || numeric === 0) return '$0'
  const prefix = numeric > 0 ? '+' : numeric < 0 ? '-' : ''
  return `${prefix}${formatCurrency(Math.abs(numeric))}`
}
