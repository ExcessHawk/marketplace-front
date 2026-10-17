import { Card, Chip, Skeleton } from '@heroui/react'
import { ClockIcon, CoinsIcon, WalletIcon } from '@phosphor-icons/react'
import { PAYOUT_STATUS_LABELS, type PayoutStatus } from '@marketplace/contracts'
import { useEarnings } from '../../api/orders'
import { Empty, ErrorState } from '../../components/States'
import { formatDate, formatPrice } from '../../lib/format'
import { errorMessage } from '../../lib/problem'

const STATUS_VARIANT: Record<PayoutStatus, 'primary' | 'secondary' | 'tertiary'> = {
  pending: 'secondary',
  paid: 'primary',
  failed: 'tertiary',
}

export function EarningsPage() {
  const earnings = useEarnings()

  if (earnings.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-(--radius-marketplace)" />
        <Skeleton className="h-48 rounded-(--radius-marketplace)" />
      </div>
    )
  }

  if (earnings.isError) {
    return <ErrorState message={errorMessage(earnings.error)} onRetry={() => earnings.refetch()} />
  }

  const { pending, held, paidTotalCents, lines, payouts, holdDays } = earnings.data

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Pagos</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-(--radius-marketplace) border p-4">
          <p className="flex items-center gap-2 text-sm opacity-70">
            <WalletIcon size={16} />
            Listo para depositar
          </p>
          <p className="mt-1 text-2xl tabular-nums">{formatPrice(pending.amountCents)}</p>
          <p className="text-xs opacity-60">
            {pending.count} {pending.count === 1 ? 'venta' : 'ventas'}
          </p>
        </div>

        <div className="rounded-(--radius-marketplace) border p-4">
          <p className="flex items-center gap-2 text-sm opacity-70">
            <ClockIcon size={16} />
            Retenido
          </p>
          <p className="mt-1 text-2xl tabular-nums">{formatPrice(held.amountCents)}</p>
          <p className="text-xs opacity-60">
            {holdDays === 0
              ? 'Sin retención configurada'
              : held.nextReleaseAt
                ? `Se libera el ${formatDate(held.nextReleaseAt)}`
                : `${holdDays} días después de entregar`}
          </p>
        </div>

        <div className="rounded-(--radius-marketplace) border p-4">
          <p className="flex items-center gap-2 text-sm opacity-70">
            <CoinsIcon size={16} />
            Ya depositado
          </p>
          <p className="mt-1 text-2xl tabular-nums">{formatPrice(paidTotalCents)}</p>
          <p className="text-xs opacity-60">Histórico</p>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg">Ventas por cobrar</h2>
          <p className="text-sm opacity-60">
            El dinero se libera cuando el comprador confirma que recibió el pedido
            {holdDays > 0 ? `, y se deposita ${holdDays} días después` : ''}.
          </p>
        </div>

        {lines.length === 0 ? (
          <Empty
            title="Nada por cobrar todavía"
            message="Aquí aparece cada venta entregada, con su desglose."
          />
        ) : (
          <Card className="rounded-(--radius-marketplace)">
            <Card.Content className="pt-6">
              <ul className="divide-y text-sm">
                {lines.map((line) => (
                  <li key={line.suborderId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <span className="tabular-nums">{line.orderNumber}</span>
                    {line.held && (
                      <Chip size="sm" variant="secondary">
                        retenido
                      </Chip>
                    )}
                    <span className="text-xs opacity-60">
                      entregado {formatDate(line.deliveredAt)}
                      {line.held && line.releasesAt ? ` · se libera ${formatDate(line.releasesAt)}` : ''}
                    </span>
                    <span className="ml-auto text-xs opacity-60">
                      {formatPrice(line.subtotalCents)} + {formatPrice(line.shippingCents)} envío −{' '}
                      {formatPrice(line.commissionCents)} comisión
                    </span>
                    <span className="w-24 text-right tabular-nums">
                      {formatPrice(line.payoutCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card.Content>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg">Depósitos</h2>

        {payouts.length === 0 ? (
          <Empty title="Todavía no hay depósitos" />
        ) : (
          <Card className="rounded-(--radius-marketplace)">
            <Card.Content className="pt-6">
              <ul className="divide-y text-sm">
                {payouts.map((payout) => (
                  <li key={payout.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <Chip size="sm" variant={STATUS_VARIANT[payout.status]}>
                      {PAYOUT_STATUS_LABELS[payout.status]}
                    </Chip>
                    <span className="text-xs opacity-60">
                      {payout.suborderCount}{' '}
                      {payout.suborderCount === 1 ? 'venta' : 'ventas'} ·{' '}
                      {formatDate(payout.paidAt ?? payout.createdAt)}
                    </span>
                    {payout.transferId && (
                      <span className="font-mono text-xs opacity-50">{payout.transferId}</span>
                    )}
                    {payout.failureReason && (
                      <span className="text-xs opacity-70">{payout.failureReason}</span>
                    )}
                    <span className="ml-auto tabular-nums">{formatPrice(payout.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </Card.Content>
          </Card>
        )}
      </section>
    </div>
  )
}
