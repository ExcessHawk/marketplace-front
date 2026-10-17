import { Button, Card, Chip, Skeleton, TextField, Input } from '@heroui/react'
import { TruckIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  SUBORDER_STATUS_LABELS,
  type SaleView,
  type SuborderStatus,
} from '@marketplace/contracts'
import { useSales, useShipSuborder } from '../../api/orders'
import { Pager } from '../../components/Pager'
import { Empty, ErrorState } from '../../components/States'
import { formatDate, formatPrice } from '../../lib/format'
import { errorMessage } from '../../lib/problem'
import { ChatPanel } from '../../components/ChatPanel'

const TABS: Array<{ id: SuborderStatus | 'all'; label: string }> = [
  { id: 'pending_shipment', label: 'Por enviar' },
  { id: 'shipped', label: 'En camino' },
  { id: 'delivered', label: 'Entregadas' },
  { id: 'all', label: 'Todas' },
]

const VARIANT: Record<SuborderStatus, 'primary' | 'secondary' | 'tertiary'> = {
  pending_payment: 'secondary',
  pending_shipment: 'secondary',
  shipped: 'primary',
  delivered: 'primary',
  cancelled: 'tertiary',
  refunded: 'tertiary',
}

function Sale({ sale }: { sale: SaleView }) {
  const ship = useShipSuborder()
  const [open, setOpen] = useState(false)
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')

  const ready = carrier.trim().length >= 2 && tracking.trim().length >= 4
  const snapshot = sale.shippingSnapshot

  return (
    <Card className="rounded-(--radius-marketplace)">
      <Card.Header>
        <div className="flex flex-wrap items-center gap-2">
          <Card.Title className="text-base tabular-nums">{sale.orderNumber}</Card.Title>
          <Chip size="sm" variant={VARIANT[sale.status]}>
            {SUBORDER_STATUS_LABELS[sale.status]}
          </Chip>
          <span className="text-xs opacity-60">{formatDate(sale.createdAt)}</span>
        </div>
      </Card.Header>

      <Card.Content className="space-y-3 text-sm">
        <div>
          {sale.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="opacity-80">
                {item.quantity} × {item.productTitle}
                <span className="opacity-60"> · {item.variantName}</span>
                {item.sku && <span className="opacity-50"> · {item.sku}</span>}
              </span>
              <span className="tabular-nums">{formatPrice(item.lineTotalCents)}</span>
            </div>
          ))}
        </div>

        <div className="rounded-(--radius-marketplace) bg-(--color-default-100) p-3">
          <p className="opacity-70">Enviar a</p>
          <p>
            {snapshot.recipient} · {snapshot.phone}
          </p>
          <p className="opacity-80">
            {snapshot.street}
            {snapshot.interior ? ` int. ${snapshot.interior}` : ''}, {snapshot.neighborhood},{' '}
            {snapshot.city}, {snapshot.state}, C.P. {snapshot.postalCode}
          </p>
          {snapshot.notes && <p className="opacity-70">{snapshot.notes}</p>}
        </div>

        <dl className="space-y-1">
          <div className="flex justify-between">
            <dt className="opacity-70">Productos</dt>
            <dd className="tabular-nums">{formatPrice(sale.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-70">Envío que cobraste</dt>
            <dd className="tabular-nums">{formatPrice(sale.shippingCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-70">Comisión de la plataforma</dt>
            <dd className="tabular-nums">−{formatPrice(sale.commissionCents)}</dd>
          </div>
          <div className="flex justify-between border-t pt-1 font-medium">
            <dt>Te toca</dt>
            <dd className="tabular-nums">{formatPrice(sale.payoutCents)}</dd>
          </div>
        </dl>

        {sale.trackingNumber && (
          <p className="flex items-center gap-2 opacity-80">
            <TruckIcon size={16} />
            {sale.trackingCarrier} · {sale.trackingNumber}
          </p>
        )}
      </Card.Content>

      <Card.Footer className="flex-col items-stretch gap-2">
        <ChatPanel suborderId={sale.id} />
      </Card.Footer>

      {sale.status === 'pending_shipment' && (
        <Card.Footer className="flex-col items-stretch gap-2">
          {open ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <TextField aria-label="Paquetería" value={carrier} onChange={setCarrier} fullWidth>
                  <Input placeholder="Paquetería (Estafeta, DHL…)" />
                </TextField>
                <TextField aria-label="Guía" value={tracking} onChange={setTracking} fullWidth>
                  <Input placeholder="Número de guía" />
                </TextField>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  isDisabled={!ready}
                  isPending={ship.isPending}
                  onPress={() =>
                    ship.mutate(
                      { id: sale.id, carrier: carrier.trim(), trackingNumber: tracking.trim() },
                      {
                        onSuccess: () => {
                          toast.success('Marcado como enviado')
                          setOpen(false)
                        },
                        onError: (error) => toast.error(errorMessage(error)),
                      },
                    )
                  }
                >
                  Marcar enviado
                </Button>
                <Button size="sm" variant="ghost" onPress={() => setOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <Button size="sm" variant="primary" onPress={() => setOpen(true)}>
              <TruckIcon size={16} />
              Marcar como enviado
            </Button>
          )}
        </Card.Footer>
      )}
    </Card>
  )
}

export function SalesPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('estado') as SuborderStatus | 'all' | null) ?? 'pending_shipment'
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  const sales = useSales(status, page)

  function patch(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set(key, value)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Ventas</h1>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => patch('estado', tab.id)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              status === tab.id ? 'bg-(--color-default-100) font-medium' : 'opacity-60 hover:opacity-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {sales.isPending && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48 rounded-(--radius-marketplace)" />
          ))}
        </div>
      )}

      {sales.isError && (
        <ErrorState message={errorMessage(sales.error)} onRetry={() => sales.refetch()} />
      )}

      {sales.data && sales.data.items.length === 0 && (
        <Empty
          title={status === 'pending_shipment' ? 'Nada por enviar' : 'Nada con ese filtro'}
          message={
            status === 'pending_shipment'
              ? 'Cuando alguien compre y pague, aparece aquí con su dirección.'
              : undefined
          }
        />
      )}

      {sales.data && sales.data.items.length > 0 && (
        <>
          <div className="space-y-4">
            {sales.data.items.map((sale) => (
              <Sale key={sale.id} sale={sale} />
            ))}
          </div>
          <Pager
            page={sales.data.page}
            totalPages={sales.data.totalPages}
            total={sales.data.total}
            onChange={(next) => patch('page', String(next))}
          />
        </>
      )}
    </div>
  )
}
