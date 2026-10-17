import { Button, EmptyState, Skeleton, Spinner } from '@heroui/react'
import { ArrowClockwiseIcon, PackageIcon, WarningCircleIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

export function FullPageSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center gap-3">
      <Spinner />
      <span className="text-sm opacity-70">{label}</span>
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-56 rounded-(--radius-marketplace)" />
      ))}
    </div>
  )
}

export function ErrorState({
  title = 'No se pudo cargar',
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <EmptyState className="py-16">
      <WarningCircleIcon size={40} weight="duotone" className="opacity-60" />
      <p className="text-lg">{title}</p>
      {message && <p className="max-w-prose text-sm opacity-70">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onPress={onRetry} className="mt-2">
          <ArrowClockwiseIcon size={16} />
          Reintentar
        </Button>
      )}
    </EmptyState>
  )
}

export function Empty({
  title,
  message,
  icon,
  action,
}: {
  title: string
  message?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <EmptyState className="rounded-(--radius-marketplace) border border-dashed py-16">
      {icon ?? <PackageIcon size={40} weight="duotone" className="opacity-50" />}
      <p className="text-lg">{title}</p>
      {message && <p className="max-w-prose text-sm opacity-70">{message}</p>}
      {action}
    </EmptyState>
  )
}
