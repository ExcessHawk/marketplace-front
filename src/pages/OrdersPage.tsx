import { Button, Chip, Skeleton } from '@heroui/react'
import { PackageIcon } from '@phosphor-icons/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@marketplace/contracts'
import { useOrders } from '../api/orders'
import { Pager } from '../components/Pager'
import { Empty, ErrorState } from '../components/States'
import { formatDate, formatPrice } from '../lib/format'
import { errorMessage } from '../lib/problem'

const STATUS_VARIANT: Record<OrderStatus, 'primary' | 'secondary' | 'tertiary'> = {
  pending_payment: 'secondary',
  paid: 'primary',
  cancelled: 'tertiary',
  refunded: 'tertiary',
}

export function OrdersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  const orders = useOrders(page)

  if (orders.isPending) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-(--radius-marketplace)" />
        ))}
      </div>
    )
  }

  if (orders.isError) {
    return <ErrorState message={errorMessage(orders.error)} onRetry={() => orders.refetch()} />
  }

  if (orders.data.items.length === 0) {
    return (
      <Empty
        icon={<PackageIcon size={40} weight="duotone" className="opacity-50" />}
        title="Todavía no has comprado nada"
        action={
          <Button variant="primary" className="mt-2" onPress={() => navigate('/')}>
            Ver el catálogo
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Mis pedidos</h1>

      <ul className="space-y-3">
        {orders.data.items.map((order) => (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => navigate(`/pedidos/${order.id}`)}
              className="flex w-full flex-wrap items-center gap-3 rounded-(--radius-marketplace) border p-4 text-left transition hover:shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="tabular-nums">{order.number}</p>
                <p className="text-xs opacity-60">
                  {formatDate(order.createdAt)} · {order.itemCount}{' '}
                  {order.itemCount === 1 ? 'artículo' : 'artículos'} ·{' '}
                  {order.storeNames.join(', ')}
                </p>
              </div>

              <Chip size="sm" variant={STATUS_VARIANT[order.status]}>
                {ORDER_STATUS_LABELS[order.status]}
              </Chip>

              <span className="tabular-nums">{formatPrice(order.totalCents)}</span>
            </button>
          </li>
        ))}
      </ul>

      <Pager
        page={orders.data.page}
        totalPages={orders.data.totalPages}
        total={orders.data.total}
        onChange={(next) => setParams({ page: String(next) })}
      />
    </div>
  )
}
