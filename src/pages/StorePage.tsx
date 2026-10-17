import { Skeleton } from '@heroui/react'
import { StorefrontIcon } from '@phosphor-icons/react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useProducts, useStore } from '../api/catalog'
import { Pager } from '../components/Pager'
import { ProductCard } from '../components/ProductCard'
import { CardGridSkeleton, Empty, ErrorState } from '../components/States'
import { formatDate } from '../lib/format'
import { errorMessage, statusOf } from '../lib/problem'
import { RatingBadge } from '../components/Rating'

const PAGE_SIZE = 12

export function StorePage() {
  const { slug } = useParams<{ slug: string }>()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)

  const store = useStore(slug)
  const products = useProducts({ seller: slug, page, limit: PAGE_SIZE, sort: 'newest' })

  if (store.isPending) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-32 rounded-(--radius-marketplace)" />
        <CardGridSkeleton />
      </div>
    )
  }

  if (store.isError) {
    const notFound = statusOf(store.error) === 404
    return (
      <ErrorState
        title={notFound ? 'Esta tienda no existe' : 'No se pudo cargar la tienda'}
        message={
          notFound
            ? 'La dirección puede estar mal escrita, o la tienda ya no está activa.'
            : errorMessage(store.error)
        }
        onRetry={notFound ? undefined : () => store.refetch()}
      />
    )
  }

  return (
    <div className="space-y-8">
      <header className="rounded-(--radius-marketplace) border p-6">
        <div className="flex items-start gap-4">
          <StorefrontIcon size={40} weight="duotone" className="shrink-0 opacity-70" />
          <div className="min-w-0 space-y-1">
            <h1 className="text-3xl">{store.data.storeName}</h1>
            <p className="text-sm opacity-60">
              En el marketplace desde {formatDate(store.data.createdAt)}
            </p>
            <RatingBadge
              average={typeof store.data.ratingAvg === 'number' ? store.data.ratingAvg : null}
              count={store.data.ratingCount}
              size={16}
            />
            {store.data.description && (
              <p className="max-w-prose pt-2 text-sm opacity-80">{store.data.description}</p>
            )}
          </div>
        </div>
      </header>

      {products.isPending && <CardGridSkeleton count={PAGE_SIZE} />}

      {products.isError && (
        <ErrorState message={errorMessage(products.error)} onRetry={() => products.refetch()} />
      )}

      {products.data && products.data.items.length === 0 && (
        <Empty
          title="Esta tienda todavía no publica nada"
          message="Vuelve más tarde — o escríbele al vendedor."
        />
      )}

      {products.data && products.data.items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.data.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pager
            page={products.data.page}
            totalPages={products.data.totalPages}
            total={products.data.total}
            onChange={(next) => setParams({ page: String(next) })}
          />
        </>
      )}
    </div>
  )
}
