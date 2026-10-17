const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
})

const longDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' })

export function formatPrice(cents: number): string {
  return mxn.format(cents / 100)
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '—' : longDate.format(date)
}

export function pesosToCents(pesos: number | string): number {
  const value = typeof pesos === 'string' ? Number.parseFloat(pesos) : pesos
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

export function centsToPesos(cents: number): number {
  return cents / 100
}
