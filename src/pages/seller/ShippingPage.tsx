import { Alert, Button, Card, Form, Switch } from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { TruckIcon } from '@phosphor-icons/react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  ReplaceShippingRatesSchema,
  ZONE_LABELS,
  type ReplaceShippingRatesDto,
  type ReplaceShippingRatesInput,
} from '@marketplace/contracts'
import { useReplaceShipping, useShippingRates } from '../../api/seller'
import { MoneyInput } from '../../components/Field'
import { ErrorState, FullPageSpinner } from '../../components/States'
import { formatPrice } from '../../lib/format'
import { applyViolations, errorMessage } from '../../lib/problem'

const EMPTY_RATE = { baseCents: 0, perKgCents: 0, freeOverCents: null }

export function ShippingPage() {
  const rates = useShippingRates()
  const replace = useReplaceShipping()

  const nacional = rates.data?.find((rate) => rate.zone === 'nacional')
  const local = rates.data?.find((rate) => rate.zone === 'local')

  const form = useForm<ReplaceShippingRatesInput, unknown, ReplaceShippingRatesDto>({
    resolver: zodResolver(ReplaceShippingRatesSchema),
    values: {
      rates: [
        {
          zone: 'nacional' as const,
          baseCents: nacional?.baseCents ?? 0,
          perKgCents: nacional?.perKgCents ?? 0,
          freeOverCents: nacional?.freeOverCents ?? null,
        },
        ...(local
          ? [
              {
                zone: 'local' as const,
                baseCents: local.baseCents,
                perKgCents: local.perKgCents,
                freeOverCents: local.freeOverCents,
              },
            ]
          : []),
      ],
    },
  })

  const hasLocal = form.watch('rates').length > 1
  const freeOver = form.watch('rates.0.freeOverCents')

  if (rates.isPending) return <FullPageSpinner />
  if (rates.isError) {
    return <ErrorState message={errorMessage(rates.error)} onRetry={() => rates.refetch()} />
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await replace.mutateAsync({
        rates: values.rates.map((rate) => ({
          ...rate,
          freeOverCents: rate.freeOverCents || null,
        })),
      })
      toast.success('Tarifas guardadas')
    } catch (error) {
      if (!applyViolations(error, form.setError)) toast.error(errorMessage(error))
    }
  })

  const toggleLocal = (on: boolean) => {
    const current = form.getValues('rates')
    form.setValue(
      'rates',
      on ? [current[0], { zone: 'local', ...EMPTY_RATE }] : [current[0]],
      { shouldDirty: true },
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <TruckIcon size={28} weight="duotone" />
        <h1 className="text-2xl">Envíos</h1>
      </div>

      {!nacional && (
        <Alert status="warning">
          <Alert.Content>
            <Alert.Description>
              Sin tarifa nacional tus productos aparecen en el carrito sin costo de envío y nadie
              puede terminar la compra.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Form onSubmit={onSubmit} className="space-y-6">
        <Card className="rounded-(--radius-marketplace)">
          <Card.Header>
            <Card.Title className="text-base">{ZONE_LABELS.nacional}</Card.Title>
            <Card.Description>Lo que cobras por mandar a cualquier estado.</Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-4 sm:grid-cols-2">
            <MoneyInput
              control={form.control}
              name="rates.0.baseCents"
              label="Costo base"
              isRequired
            />
            <MoneyInput
              control={form.control}
              name="rates.0.perKgCents"
              label="Por kilo"
              description="Se cobra por kilo completo, redondeando hacia arriba."
            />
            <div className="sm:col-span-2">
              <MoneyInput
                control={form.control}
                name="rates.0.freeOverCents"
                label="Envío gratis a partir de"
                description="Opcional. Déjalo en blanco si nunca va gratis."
              />
            </div>
          </Card.Content>
        </Card>

        <div className="flex items-center justify-between rounded-(--radius-marketplace) border p-4">
          <div>
            <p>Tarifa para tu ciudad</p>
            <p className="text-sm opacity-60">
              Una tarifa más barata para entregas locales. Opcional.
            </p>
          </div>
          <Switch isSelected={hasLocal} onChange={toggleLocal} aria-label="Tarifa local">
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </div>

        {hasLocal && (
          <Card className="rounded-(--radius-marketplace)">
            <Card.Header>
              <Card.Title className="text-base">{ZONE_LABELS.local}</Card.Title>
            </Card.Header>
            <Card.Content className="grid gap-4 sm:grid-cols-2">
              <MoneyInput control={form.control} name="rates.1.baseCents" label="Costo base" />
              <MoneyInput control={form.control} name="rates.1.perKgCents" label="Por kilo" />
            </Card.Content>
          </Card>
        )}

        <div className="rounded-(--radius-marketplace) bg-(--color-default-100) p-4 text-sm">
          <p className="opacity-70">Ejemplo con un paquete de 2.3 kg:</p>
          <p className="mt-1 tabular-nums">
            {formatPrice(form.watch('rates.0.baseCents') || 0)} +{' '}
            {formatPrice((form.watch('rates.0.perKgCents') || 0) * 3)} ={' '}
            <strong>
              {formatPrice(
                (form.watch('rates.0.baseCents') || 0) + (form.watch('rates.0.perKgCents') || 0) * 3,
              )}
            </strong>
          </p>
          {Boolean(freeOver) && (
            <p className="mt-1 opacity-70">
              Gratis cuando la compra en tu tienda pase de {formatPrice(freeOver || 0)}.
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          isDisabled={!form.formState.isDirty}
          isPending={form.formState.isSubmitting}
        >
          Guardar tarifas
        </Button>
      </Form>
    </div>
  )
}
