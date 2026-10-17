import { Alert, Button, Card, Form, ListBox, Select } from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { MapPinIcon, PlusIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CreateAddressSchema,
  MEXICAN_STATE_LIST,
  formatAddress,
  type CheckoutBlocker,
  type CreateAddressDto,
  type CreateAddressInput,
} from '@marketplace/contracts'
import { useCart } from '../api/cart'
import { useAddresses, useCheckout, useCreateAddress } from '../api/orders'
import { TextAreaInput, TextInput } from '../components/Field'
import { Empty, ErrorState, FullPageSpinner } from '../components/States'
import { formatPrice } from '../lib/format'
import { errorMessage, problemOf } from '../lib/problem'

const BLOCKER_TEXT: Record<CheckoutBlocker['reason'], string> = {
  unavailable: 'ya no está disponible',
  out_of_stock: 'se agotó',
  low_stock: 'quedan menos de los que pediste',
  store_closed: 'la tienda dejó de recibir pedidos',
  no_shipping: 'esa tienda no tiene envío configurado',
}

function AddressForm({ onDone }: { onDone: (id: string) => void }) {
  const create = useCreateAddress()

  const form = useForm<CreateAddressInput, unknown, CreateAddressDto>({
    resolver: zodResolver(CreateAddressSchema),
    defaultValues: {
      label: '',
      recipient: '',
      phone: '',
      street: '',
      interior: '',
      neighborhood: '',
      city: '',
      state: undefined,
      postalCode: '',
      notes: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await create.mutateAsync({
        ...values,
        label: values.label?.trim() || undefined,
        interior: values.interior?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      })
      toast.success('Dirección guardada')
      onDone(created.id)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  })

  return (
    <Form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput control={form.control} name="recipient" label="Quién recibe" isRequired />
        <TextInput
          control={form.control}
          name="phone"
          type="tel"
          label="Teléfono"
          description="Diez dígitos."
          isRequired
        />
        <TextInput control={form.control} name="street" label="Calle y número" isRequired />
        <TextInput control={form.control} name="interior" label="Interior" />
        <TextInput control={form.control} name="neighborhood" label="Colonia" isRequired />
        <TextInput control={form.control} name="city" label="Ciudad o municipio" isRequired />

        <Controller
          control={form.control}
          name="state"
          render={({ field, fieldState }) => (
            <div className="space-y-1">
              <label className="text-sm">
                Estado <span className="text-(--color-danger)">*</span>
              </label>
              <Select
                aria-label="Estado"
                selectedKey={field.value ?? null}
                onSelectionChange={(key) => field.onChange(key ? String(key) : undefined)}
                isInvalid={Boolean(fieldState.error)}
                placeholder="Elige uno"
                fullWidth
              >
                <Select.Trigger className="rounded-(--radius-marketplace)">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {MEXICAN_STATE_LIST.map((state) => (
                      <ListBox.Item key={state} id={state} textValue={state}>
                        {state}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              {fieldState.error && (
                <p className="text-xs text-(--color-danger)">{fieldState.error.message}</p>
              )}
            </div>
          )}
        />

        <TextInput
          control={form.control}
          name="postalCode"
          label="Código postal"
          description="Cinco dígitos."
          isRequired
        />
      </div>

      <TextAreaInput
        control={form.control}
        name="notes"
        label="Referencias"
        description="Opcional. Entre qué calles, color de la casa, con quién dejarlo."
        rows={2}
      />
      <TextInput control={form.control} name="label" label="Nombre para esta dirección" />

      <Button type="submit" variant="primary" isPending={form.formState.isSubmitting}>
        Guardar dirección
      </Button>
    </Form>
  )
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const cart = useCart()
  const addresses = useAddresses()
  const checkout = useCheckout()

  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (selected || !addresses.data?.length) return
    setSelected((addresses.data.find((a) => a.isDefault) ?? addresses.data[0]).id)
  }, [addresses.data, selected])

  if (cart.isPending || addresses.isPending) return <FullPageSpinner />
  if (cart.isError) return <ErrorState message={errorMessage(cart.error)} onRetry={() => cart.refetch()} />

  if (cart.data.groups.length === 0) {
    return (
      <Empty
        title="No hay nada que pagar"
        message="Tu carrito está vacío."
        action={
          <Button variant="primary" className="mt-2" onPress={() => navigate('/')}>
            Ver el catálogo
          </Button>
        }
      />
    )
  }

  const blockers = (problemOf(checkout.error)?.details as { blockers?: CheckoutBlocker[] } | undefined)
    ?.blockers

  const onPay = async () => {
    if (!selected) return
    try {
      const result = await checkout.mutateAsync(selected)
      navigate(`/pedidos/${result.order.id}`, { state: { payment: result.payment } })
    } catch (error) {
      if (!problemOf(error)?.details) toast.error(errorMessage(error))
    }
  }

  const needsAddress = (addresses.data?.length ?? 0) === 0

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <h1 className="text-3xl">Pagar</h1>

        {blockers && blockers.length > 0 && (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Title>No se pudo completar la compra</Alert.Title>
              <Alert.Description>
                <ul className="mt-1 list-disc pl-4">
                  {blockers.map((blocker, i) => (
                    <li key={i}>
                      {blocker.productTitle}
                      {blocker.variantName ? ` · ${blocker.variantName}` : ''}:{' '}
                      {BLOCKER_TEXT[blocker.reason]}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onPress={() => navigate('/carrito')}
                >
                  Volver al carrito
                </Button>
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <Card className="rounded-(--radius-marketplace)">
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-base">
              <MapPinIcon size={18} weight="duotone" />
              Dónde lo entregamos
            </Card.Title>
          </Card.Header>

          <Card.Content className="space-y-3">
            {needsAddress && !adding && (
              <p className="text-sm opacity-70">Todavía no tienes direcciones guardadas.</p>
            )}

            {addresses.data?.map((address) => (
              <label
                key={address.id}
                className={`flex cursor-pointer gap-3 rounded-(--radius-marketplace) border p-3 text-sm transition ${
                  selected === address.id ? 'border-current' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <input
                  type="radio"
                  name="address"
                  checked={selected === address.id}
                  onChange={() => setSelected(address.id)}
                  className="mt-1"
                />
                <span>
                  <strong>{address.label ?? address.recipient}</strong>
                  <span className="block opacity-70">{formatAddress(address)}</span>
                  <span className="block opacity-60">
                    {address.recipient} · {address.phone}
                  </span>
                </span>
              </label>
            ))}

            {adding ? (
              <div className="rounded-(--radius-marketplace) border p-4">
                <AddressForm
                  onDone={(id) => {
                    setSelected(id)
                    setAdding(false)
                  }}
                />
              </div>
            ) : (
              <Button size="sm" variant="outline" onPress={() => setAdding(true)}>
                <PlusIcon size={16} />
                Agregar dirección
              </Button>
            )}
          </Card.Content>
        </Card>

        {cart.data.groups.map((group) => (
          <Card key={group.seller.id} className="rounded-(--radius-marketplace)">
            <Card.Header>
              <Card.Title className="text-base">{group.seller.storeName}</Card.Title>
            </Card.Header>
            <Card.Content className="space-y-1 text-sm">
              {group.lines.map((line) => (
                <div key={line.id} className="flex justify-between">
                  <span className="opacity-80">
                    {line.quantity} × {line.product.title}
                    <span className="opacity-60"> · {line.variant.name}</span>
                  </span>
                  <span className="tabular-nums">{formatPrice(line.lineTotalCents)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1">
                <span className="opacity-70">Envío</span>
                <span className="tabular-nums">
                  {group.shippingCents === 0 ? 'Gratis' : formatPrice(group.shippingCents ?? 0)}
                </span>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>

      <aside className="h-fit space-y-4 rounded-(--radius-marketplace) border p-5 lg:sticky lg:top-24">
        <h2 className="text-lg">Resumen</h2>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="opacity-70">Productos</dt>
            <dd className="tabular-nums">{formatPrice(cart.data.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-70">Envío</dt>
            <dd className="tabular-nums">{formatPrice(cart.data.shippingCents)}</dd>
          </div>
        </dl>

        <div className="flex justify-between border-t pt-3 text-lg">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(cart.data.totalCents)}</span>
        </div>

        <Button
          variant="primary"
          fullWidth
          size="lg"
          isDisabled={!selected || cart.data.hasBlockers || cart.data.hasUnconfiguredShipping}
          isPending={checkout.isPending}
          onPress={onPay}
        >
          Confirmar pedido
        </Button>

        {!selected && <p className="text-center text-xs opacity-60">Elige una dirección.</p>}
        {cart.data.hasBlockers && (
          <p className="text-center text-xs opacity-60">
            Hay artículos que ya no se pueden comprar. Quítalos del carrito.
          </p>
        )}
      </aside>
    </div>
  )
}
