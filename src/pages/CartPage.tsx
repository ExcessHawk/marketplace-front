import { Alert, Button, Card, Chip, Skeleton } from '@heroui/react'
import {
  ImageIcon,
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { CartGroup, CartLine, CartLineIssue } from '@marketplace/contracts'
import { useCart, useClearCart, useRemoveCartItem, useUpdateCartItem } from '../api/cart'
import { Empty, ErrorState } from '../components/States'
import { formatPrice } from '../lib/format'
import { errorMessage } from '../lib/problem'

const ISSUE_TEXT: Record<CartLineIssue, string> = {
  unavailable: 'Ya no está disponible',
  out_of_stock: 'Agotado',
  low_stock: 'Quedan menos de los que pediste',
  store_closed: 'La tienda no está recibiendo pedidos',
}

function Line({ line }: { line: CartLine }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const busy = update.isPending || remove.isPending

  const setQuantity = (quantity: number) =>
    update.mutate({ id: line.id, quantity }, { onError: (e) => toast.error(errorMessage(e)) })

  return (
    <li className={`flex gap-4 py-4 ${line.issue ? 'opacity-60' : ''}`}>
      <Link
        to={`/p/${line.product.slug}`}
        className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-(--radius-marketplace) bg-(--color-default-100)"
      >
        {line.product.imageKey ? (
          <img src={line.product.imageKey} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon size={24} weight="duotone" className="opacity-30" />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link to={`/p/${line.product.slug}`} className="hover:underline">
          {line.product.title}
        </Link>
        <p className="text-sm opacity-60">{line.variant.name}</p>

        {line.issue && (
          <Chip size="sm" variant="tertiary" className="mt-1">
            {ISSUE_TEXT[line.issue]}
            {line.issue === 'low_stock' ? ` (${line.availableStock})` : ''}
          </Chip>
        )}

        {!line.issue && line.priceDeltaCents !== 0 && (
          <p className="mt-1 text-xs opacity-70">
            {line.priceDeltaCents > 0 ? 'Subió a ' : 'Bajó a '}
            {formatPrice(line.currentPriceCents)} desde que lo agregaste. Te respetamos{' '}
            {formatPrice(line.priceCentsAtAdd)}.
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center rounded-(--radius-marketplace) border">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Quitar uno"
              isDisabled={busy || line.quantity <= 1}
              onPress={() => setQuantity(line.quantity - 1)}
            >
              <MinusIcon size={14} />
            </Button>
            <span className="min-w-8 text-center text-sm tabular-nums">{line.quantity}</span>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Agregar uno"
              isDisabled={busy || line.quantity >= line.availableStock}
              onPress={() => setQuantity(line.quantity + 1)}
            >
              <PlusIcon size={14} />
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            aria-label="Quitar del carrito"
            isPending={remove.isPending}
            onPress={() =>
              remove.mutate(line.id, { onError: (e) => toast.error(errorMessage(e)) })
            }
          >
            <TrashIcon size={16} />
          </Button>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-lg tabular-nums">{formatPrice(line.lineTotalCents)}</p>
        {line.quantity > 1 && (
          <p className="text-xs opacity-60">{formatPrice(line.priceCentsAtAdd)} c/u</p>
        )}
      </div>
    </li>
  )
}

function Group({ group }: { group: CartGroup }) {
  return (
    <Card className="rounded-(--radius-marketplace)">
      <Card.Header>
        <Card.Title className="text-base">
          <Link to={`/t/${group.seller.slug}`} className="hover:underline">
            {group.seller.storeName}
          </Link>
        </Card.Title>
      </Card.Header>

      <Card.Content>
        <ul className="divide-y">
          {group.lines.map((line) => (
            <Line key={line.id} line={line} />
          ))}
        </ul>
      </Card.Content>

      <Card.Footer className="flex-col items-stretch gap-1 text-sm">
        <div className="flex justify-between">
          <span className="opacity-70">Productos</span>
          <span className="tabular-nums">{formatPrice(group.subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-70">Envío</span>
          {group.shippingCents === null ? (
            <span className="opacity-60">esta tienda aún no lo configura</span>
          ) : group.shippingCents === 0 ? (
            <span>Gratis</span>
          ) : (
            <span className="tabular-nums">{formatPrice(group.shippingCents)}</span>
          )}
        </div>
        {group.missingForFreeCents !== null && group.missingForFreeCents > 0 && (
          <p className="text-xs opacity-70">
            Te faltan {formatPrice(group.missingForFreeCents)} para envío gratis de esta tienda.
          </p>
        )}
      </Card.Footer>
    </Card>
  )
}

export function CartPage() {
  const navigate = useNavigate()
  const cart = useCart()
  const clear = useClearCart()

  if (cart.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-(--radius-marketplace)" />
      </div>
    )
  }

  if (cart.isError) {
    return <ErrorState message={errorMessage(cart.error)} onRetry={() => cart.refetch()} />
  }

  if (cart.data.groups.length === 0) {
    return (
      <Empty
        icon={<ShoppingCartIcon size={40} weight="duotone" className="opacity-50" />}
        title="Tu carrito está vacío"
        message="Lo que agregues se queda aquí, aunque cambies de teléfono."
        action={
          <Button variant="primary" className="mt-2" onPress={() => navigate('/')}>
            Ver el catálogo
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl">Carrito</h1>
          <Button
            size="sm"
            variant="ghost"
            isPending={clear.isPending}
            onPress={() => clear.mutate()}
          >
            Vaciar
          </Button>
        </div>

        {cart.data.hasBlockers && (
          <Alert status="warning">
            <Alert.Content>
              <Alert.Description>
                Hay artículos que ya no se pueden comprar. No cuentan en el total; quítalos para
                continuar.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {cart.data.groups.map((group) => (
          <Group key={group.seller.id} group={group} />
        ))}
      </div>

      <aside className="h-fit space-y-4 rounded-(--radius-marketplace) border p-5 lg:sticky lg:top-24">
        <h2 className="text-lg">Resumen</h2>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="opacity-70">
              {cart.data.itemCount} {cart.data.itemCount === 1 ? 'artículo' : 'artículos'}
            </dt>
            <dd className="tabular-nums">{formatPrice(cart.data.subtotalCents)}</dd>
          </div>

          <div className="flex justify-between">
            <dt className="opacity-70">
              Envío
              {cart.data.groups.length > 1 && (
                <span className="opacity-60"> · {cart.data.groups.length} tiendas</span>
              )}
            </dt>
            <dd className="tabular-nums">
              {cart.data.shippingCents === 0 ? 'Gratis' : formatPrice(cart.data.shippingCents)}
            </dd>
          </div>
        </dl>

        {cart.data.hasUnconfiguredShipping && (
          <p className="text-xs opacity-70">
            Falta el envío de alguna tienda. El total va a subir cuando lo configuren.
          </p>
        )}

        <div className="flex justify-between border-t pt-3 text-lg">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(cart.data.totalCents)}</span>
        </div>

        <Button
          variant="primary"
          fullWidth
          size="lg"
          isDisabled={cart.data.hasBlockers || cart.data.hasUnconfiguredShipping}
          onPress={() => navigate('/checkout')}
        >
          Continuar al pago
        </Button>
        {cart.data.hasBlockers && (
          <p className="text-center text-xs opacity-60">
            Quita los artículos marcados para continuar.
          </p>
        )}

        {cart.data.hasPriceChanges && (
          <p className="flex gap-2 text-xs opacity-70">
            <WarningCircleIcon size={16} className="mt-px shrink-0" />
            Algún precio cambió desde que lo agregaste. Se te cobra el que viste.
          </p>
        )}
      </aside>
    </div>
  )
}
