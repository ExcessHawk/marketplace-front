import { Button, Chip, SearchField, Skeleton, TextArea, TextField } from '@heroui/react'
import { ArrowSquareOutIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { AdminSellerRow } from '@marketplace/contracts'
import {
  useAdminSellers,
  useApproveSeller,
  useSuspendSeller,
  type SellerStatus,
} from '../../api/admin'
import { Pager } from '../../components/Pager'
import { Empty, ErrorState } from '../../components/States'
import { formatDate } from '../../lib/format'
import { errorMessage } from '../../lib/problem'

const TABS: Array<{ id: SellerStatus | 'all'; label: string }> = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'active', label: 'Activas' },
  { id: 'suspended', label: 'Suspendidas' },
  { id: 'all', label: 'Todas' },
]

const STATUS_CHIP: Record<SellerStatus, { label: string; variant: 'primary' | 'secondary' | 'tertiary' }> = {
  pending: { label: 'Pendiente', variant: 'secondary' },
  active: { label: 'Activa', variant: 'primary' },
  suspended: { label: 'Suspendida', variant: 'tertiary' },
}

function SellerRow({ seller }: { seller: AdminSellerRow }) {
  const approve = useApproveSeller()
  const suspend = useSuspendSeller()
  const [reason, setReason] = useState('')
  const [suspending, setSuspending] = useState(false)

  const chip = STATUS_CHIP[seller.status]
  const reasonTooShort = reason.trim().length < 10

  return (
    <li className="space-y-3 rounded-(--radius-marketplace) border p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-lg">{seller.storeName}</p>
            <Chip size="sm" variant={chip.variant}>
              {chip.label}
            </Chip>
            {seller.owner.isPlatformAdmin && (
              <Chip size="sm" variant="tertiary">
                admin
              </Chip>
            )}
          </div>
          <p className="text-xs opacity-60">
            /{seller.slug} · {seller.owner.fullName} · {seller.owner.email}
            {seller.owner.phone ? ` · ${seller.owner.phone}` : ''}
          </p>
          <p className="text-xs opacity-60">
            Solicitada el {formatDate(seller.createdAt)} · {seller.productCount} producto(s),{' '}
            {seller.publishedCount} publicado(s) · comisión {seller.commissionBps / 100}%
          </p>
          {seller.description && (
            <p className="mt-2 max-w-prose text-sm opacity-80">{seller.description}</p>
          )}
          {seller.statusReason && (
            <p className="mt-2 text-sm">
              <span className="opacity-60">Motivo: </span>
              {seller.statusReason}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {seller.status === 'active' && (
            <Button
              size="sm"
              variant="ghost"
              aria-label="Ver la tienda"
              onPress={() => window.open(`/t/${seller.slug}`, '_blank', 'noopener')}
            >
              <ArrowSquareOutIcon size={16} />
            </Button>
          )}

          {seller.status !== 'active' && (
            <Button
              size="sm"
              variant="primary"
              isPending={approve.isPending}
              onPress={() =>
                approve.mutate(
                  { id: seller.id },
                  {
                    onSuccess: () => toast.success(`${seller.storeName} quedó activa`),
                    onError: (error) => toast.error(errorMessage(error)),
                  },
                )
              }
            >
              {seller.status === 'pending' ? 'Aprobar' : 'Reactivar'}
            </Button>
          )}

          {seller.status !== 'suspended' && !suspending && (
            <Button size="sm" variant="outline" onPress={() => setSuspending(true)}>
              Suspender
            </Button>
          )}
        </div>
      </div>

      {suspending && (
        <div className="space-y-2 rounded-(--radius-marketplace) bg-(--color-default-100) p-3">
          <TextField
            aria-label="Motivo de la suspensión"
            value={reason}
            onChange={setReason}
            fullWidth
          >
            <TextArea rows={2} placeholder="Por qué se suspende. Lo va a leer el vendedor." />
          </TextField>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="danger"
              isDisabled={reasonTooShort}
              isPending={suspend.isPending}
              onPress={() =>
                suspend.mutate(
                  { id: seller.id, reason: reason.trim() },
                  {
                    onSuccess: () => {
                      toast.success(`${seller.storeName} quedó suspendida`)
                      setSuspending(false)
                      setReason('')
                    },
                    onError: (error) => toast.error(errorMessage(error)),
                  },
                )
              }
            >
              Suspender
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setSuspending(false)
                setReason('')
              }}
            >
              Cancelar
            </Button>
            {reasonTooShort && (
              <span className="text-xs opacity-60">Mínimo 10 caracteres.</span>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

export function SellersPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('estado') as SellerStatus | 'all' | null) ?? 'pending'
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)

  const [draft, setDraft] = useState(q)
  useEffect(() => setDraft(q), [q])

  useEffect(() => {
    if (draft === q) return
    const timer = setTimeout(() => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (draft) next.set('q', draft)
          else next.delete('q')
          next.delete('page')
          return next
        },
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [draft, q, setParams])

  function patch(key: string, value: string | undefined) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  const sellers = useAdminSellers(status, q, page)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Tiendas</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => patch('estado', tab.id)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                status === tab.id
                  ? 'bg-(--color-default-100) font-medium'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <SearchField
          aria-label="Buscar tienda"
          value={draft}
          onChange={setDraft}
          className="sm:ml-auto sm:w-72"
        >
          <SearchField.Group className="rounded-(--radius-marketplace)">
            <MagnifyingGlassIcon size={16} />
            <SearchField.Input placeholder="Nombre, dirección o correo" />
          </SearchField.Group>
        </SearchField>
      </div>

      {sellers.isPending && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-(--radius-marketplace)" />
          ))}
        </div>
      )}

      {sellers.isError && (
        <ErrorState message={errorMessage(sellers.error)} onRetry={() => sellers.refetch()} />
      )}

      {sellers.data && sellers.data.items.length === 0 && (
        <Empty
          title={
            status === 'pending' ? 'No hay nada por revisar' : 'Ninguna tienda con ese filtro'
          }
          message={
            status === 'pending'
              ? 'Cuando alguien abra una tienda, aparece aquí.'
              : q
                ? `Nada coincide con “${q}”.`
                : undefined
          }
        />
      )}

      {sellers.data && sellers.data.items.length > 0 && (
        <>
          <ul className="space-y-3">
            {sellers.data.items.map((seller) => (
              <SellerRow key={seller.id} seller={seller} />
            ))}
          </ul>
          <Pager
            page={sellers.data.page}
            totalPages={sellers.data.totalPages}
            total={sellers.data.total}
            onChange={(next) => patch('page', String(next))}
          />
        </>
      )}
    </div>
  )
}
