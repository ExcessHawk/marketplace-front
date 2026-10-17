import { StarIcon } from '@phosphor-icons/react'

export function Stars({
  value,
  size = 14,
  className = '',
}: {
  value: number
  size?: number
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-px ${className}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => (
        <StarIcon
          key={step}
          size={size}
          weight={value >= step - 0.25 ? 'fill' : 'regular'}
          className={value >= step - 0.25 ? '' : 'opacity-30'}
        />
      ))}
    </span>
  )
}

export function RatingBadge({
  average,
  count,
  size = 14,
}: {
  average: number | null
  count: number
  size?: number
}) {
  if (average === null || count === 0) {
    return <span className="text-xs opacity-50">Sin opiniones</span>
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      aria-label={`${average} de 5 estrellas, ${count} opiniones`}
    >
      <Stars value={average} size={size} />
      <span className="tabular-nums">{average.toFixed(1)}</span>
      <span className="opacity-60">({count})</span>
    </span>
  )
}

export function StarPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((step) => (
        <button
          key={step}
          type="button"
          role="radio"
          aria-checked={value === step}
          aria-label={`${step} ${step === 1 ? 'estrella' : 'estrellas'}`}
          disabled={disabled}
          onClick={() => onChange(step)}
          className="transition disabled:opacity-40"
        >
          <StarIcon
            size={24}
            weight={value >= step ? 'fill' : 'regular'}
            className={value >= step ? '' : 'opacity-30'}
          />
        </button>
      ))}
    </div>
  )
}
