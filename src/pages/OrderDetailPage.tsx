import { Alert, Button, Card, Chip } from '@heroui/react'
import { CheckCircleIcon, TruckIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ORDER_STATUS_LABELS,
  SUBORDER_STATUS_LABELS,
  type SuborderStatus,
} from '@marketplace/contracts'
import { useConfirmDelivery, useOrder, useSimulatePayment } from '../api/orders'
import { useOpenDispute, useSuborderDispute } from '../api/disputes'
import { DisputeThread, OpenDisputeForm } from '../components/DisputeThread'
import { SuborderReviews } from '../components/Reviews'
import { ChatPanel } from '../components/ChatPanel'
import { ErrorState, FullPageSpinner } from '../components/States'
import { formatDate, formatPrice } from '../lib/format'
import { errorMessage, statusOf } from '../lib/problem'

const SUBORDER_VARIANT: Record<SuborderStatus, 'primary' | 'secondary' | 'tertiary'> = {
  pending_payment: 'secondary',
  pending_shipment: 'secondary',
  shipped: 'primary',
  delivered: 'primary',
  cancelled: 'tertiary',
  refunded: 'tertiary',
}

function SuborderDispute({ suborderId, canOpen }: { suborderId: string; canOpen: boolean }) {
  const dispute = useSuborderDispute(suborderId)
  const open = useOpenDispute()
  const [asking, setAsking] = useState(false)

  if (dispute.isPending) return null

  if (dispute.data) {
    return (
      <div className="pt-3">
        <DisputeThread dispute={dispute.data} canWithdraw={dispute.data.status === 'open'} />
      </div>
    )
  }

  if (!canOpen) return null

  return asking ? (
    <div className="pt-3">
      <OpenDisputeForm
        isPending={open.isPending}
        onSubmit={(input) =>
          open.mutate(
            { suborderId, ...input },
            {
              onSuccess: () => {
                toast.success('Aclaración abierta')
                setAsking(false)
              },
              onError: (error) => toast.error(errorMessage(error)),
            },
          )
        }
      />
    </div>
  ) : (
    <Button size="sm" variant="ghost" onPress={() => setAsking(true)}>
      <WarningCircleIcon size={16} />
      Tengo un problema con este envío
    </Button>
  )
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const order = useOrder(id)
  const simulate = useSimulatePayment()
  const confirm = useConfirmDelivery()

  const payment = (location.state as { payment?: { intentId: string; provider: string } } | null)
    ?.payment

  if (order.isPending) return <FullPageSpinner />
  if (order.isError) {
    return (
      <ErrorState
        title={statusOf(order.error) === 404 ? 'Ese pedido no existe' : 'No se pudo cargar'}
        message={errorMessage(order.error)}
        onRetry={() => order.refetch()}
      />
    )
  }

  const snapshot = order.data.shippingSnapshot

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl tabular-nums">{order.data.number}</h1>
        <Chip size="sm" variant={order.data.status === 'paid' ? 'primary' : 'secondary'}>
          {ORDER_STATUS_LABELS[order.data.status]}
        </Chip>
        <span className="text-sm opacity-60">{formatDate(order.data.createdAt)}</span>
      </div>

      {order.data.status === 'pending_payment' && (
        <Alert status="warning">
          <Alert.Content>
            <Alert.Title>Falta pagar</Alert.Title>
            <Alert.Description>
              Este proyecto corre con un proveedor de pagos de mentiras: no hay Stripe conectado.
              Los botones de abajo disparan el mismo webhook que mandaría el proveedor real.
              {payment?.intentId && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    isPending={simulate.isPending}
                    onPress={() =>
                      simulate.mutate(
                        { intentId: payment.intentId, outcome: 'succeeded' },
                        {
                          onSuccess: () => toast.success('Pago aplicado'),
                          onError: (error) => toast.error(errorMessage(error)),
                        },
                      )
                    }
                  >
                    Simular pago exitoso
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    isPending={simulate.isPending}
                    onPress={() =>
                      simulate.mutate(
                        { intentId: payment.intentId, outcome: 'failed' },
                        {
                          onSuccess: () => toast.success('Pago rechazado, pedido cancelado'),
                          onError: (error) => toast.error(errorMessage(error)),
                        },
                      )
                    }
                  >
                    Simular rechazo
                  </Button>
                </div>
              )}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Card className="rounded-(--radius-marketplace)">
        <Card.Header>
          <Card.Title className="text-base">Entrega</Card.Title>
        </Card.Header>
        <Card.Content className="text-sm opacity-80">
          <p>{snapshot.recipient} · {snapshot.phone}</p>
          <p>
            {snapshot.street}
            {snapshot.interior ? ` int. ${snapshot.interior}` : ''}, {snapshot.neighborhood}
          </p>
          <p>
            {snapshot.city}, {snapshot.state} · C.P. {snapshot.postalCode}
          </p>
          {snapshot.notes && <p className="opacity-70">{snapshot.notes}</p>}
        </Card.Content>
      </Card>

      {order.data.suborders.map((suborder) => (
        <Card key={suborder.id} className="rounded-(--radius-marketplace)">
          <Card.Header>
            <div className="flex flex-wrap items-center gap-2">
              <Card.Title className="text-base">{suborder.seller.storeName}</Card.Title>
              <Chip size="sm" variant={SUBORDER_VARIANT[suborder.status]}>
                {SUBORDER_STATUS_LABELS[suborder.status]}
              </Chip>
            </div>
            {suborder.trackingNumber && (
              <Card.Description className="flex items-center gap-2">
                <TruckIcon size={16} />
                {suborder.trackingCarrier} · {suborder.trackingNumber}
              </Card.Description>
            )}
          </Card.Header>

          <Card.Content className="space-y-1 text-sm">
            {suborder.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span className="opacity-80">
                  {item.quantity} × {item.productTitle}
                  <span className="opacity-60"> · {item.variantName}</span>
                </span>
                <span className="tabular-nums">{formatPrice(item.lineTotalCents)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1">
              <span className="opacity-70">Envío</span>
              <span className="tabular-nums">
                {suborder.shippingCents === 0 ? 'Gratis' : formatPrice(suborder.shippingCents)}
              </span>
            </div>
          </Card.Content>

          {suborder.status !== 'pending_payment' && (
            <Card.Footer className="flex-col items-stretch gap-2">
              <ChatPanel suborderId={suborder.id} />
              {suborder.status === 'shipped' && (
                <Button
                  size="sm"
                  variant="primary"
                  className="self-start"
                  isPending={confirm.isPending}
                  onPress={() =>
                    confirm.mutate(suborder.id, {
                      onSuccess: () => toast.success('Gracias por confirmar'),
                      onError: (error) => toast.error(errorMessage(error)),
                    })
                  }
                >
                  <CheckCircleIcon size={16} weight="bold" />
                  Ya lo recibí
                </Button>
              )}
              <SuborderDispute suborderId={suborder.id} canOpen />
              <SuborderReviews suborderId={suborder.id} />
            </Card.Footer>
          )}
        </Card>
      ))}

      <div className="rounded-(--radius-marketplace) border p-5">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="opacity-70">Productos</dt>
            <dd className="tabular-nums">{formatPrice(order.data.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-70">Envío</dt>
            <dd className="tabular-nums">{formatPrice(order.data.shippingCents)}</dd>
          </div>
        </dl>
        <div className="mt-3 flex justify-between border-t pt-3 text-lg">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(order.data.totalCents)}</span>
        </div>
      </div>
    </div>
  )
}
