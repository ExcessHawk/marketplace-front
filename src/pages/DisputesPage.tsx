import { Skeleton } from '@heroui/react'
import { useSearchParams } from 'react-router-dom'
import type { DisputeStatus } from '@marketplace/contracts'
import { useAdminDisputes, useSellerDisputes } from '../api/disputes'
import { DisputeThread } from '../components/DisputeThread'
import { Pager } from '../components/Pager'
import { Empty, ErrorState } from '../components/States'
import { errorMessage } from '../lib/problem'

const TABS: Array<{ id: DisputeStatus | 'all'; label: string }> = [
  { id: 'open', label: 'Abiertas' },
  { id: 'resolved_buyer', label: 'A favor del comprador' },
  { id: 'resolved_seller', label: 'A favor del vendedor' },
  { id: 'all', label: 'Todas' },
]

function Disputes({ mode }: { mode: 'seller' | 'admin' }) {
  const [params, setParams] = useSearchParams()
  const status = (params.get('estado') as DisputeStatus | 'all' | null) ?? 'open'
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)

  const seller = useSellerDisputes(status, page, mode === 'seller')
  const admin = useAdminDisputes(status, page, mode === 'admin')
  const query = mode === 'admin' ? admin : seller

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
      <div>
        <h1 className="text-2xl">Aclaraciones</h1>
        <p className="text-sm opacity-60">
          {mode === 'admin'
            ? 'Mientras una está abierta, el pago de esa venta queda congelado.'
            : 'Si el comprador abre una, el pago de esa venta se detiene hasta resolverla.'}
        </p>
      </div>

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

      {query.isPending && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-(--radius-marketplace)" />
          ))}
        </div>
      )}

      {query.isError && (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      )}

      {query.data && query.data.items.length === 0 && (
        <Empty
          title={status === 'open' ? 'Nada abierto' : 'Nada con ese filtro'}
          message={
            status === 'open' && mode === 'seller'
              ? 'Buena señal: nadie tiene problemas con tus envíos.'
              : undefined
          }
        />
      )}

      {query.data && query.data.items.length > 0 && (
        <>
          <div className="space-y-4">
            {query.data.items.map((dispute) => (
              <div key={dispute.id} className="space-y-2">
                {mode === 'admin' && (
                  <p className="text-sm opacity-70">
                    {dispute.seller.storeName} · {dispute.buyer.fullName}
                  </p>
                )}
                <DisputeThread dispute={dispute} canResolve={mode === 'admin'} />
              </div>
            ))}
          </div>
          <Pager
            page={query.data.page}
            totalPages={query.data.totalPages}
            total={query.data.total}
            onChange={(next) => patch('page', String(next))}
          />
        </>
      )}
    </div>
  )
}

export function SellerDisputesPage() {
  return <Disputes mode="seller" />
}

export function AdminDisputesPage() {
  return <Disputes mode="admin" />
}
