import { Button, Chip, Skeleton } from '@heroui/react'
import { EyeIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { ProductStatus } from '@marketplace/contracts'
import {
  useDeleteProduct,
  useMyProducts,
  usePublishProduct,
  type SellerProductRow,
} from '../../api/seller'
import { Pager } from '../../components/Pager'
import { Empty, ErrorState } from '../../components/States'
import { formatDate } from '../../lib/format'
import { errorMessage } from '../../lib/problem'

const STATUS: Record<ProductStatus, { label: string; variant: 'secondary' | 'primary' | 'tertiary' }> =
  {
    draft: { label: 'Borrador', variant: 'secondary' },
    published: { label: 'Publicado', variant: 'primary' },
    archived: { label: 'Archivado', variant: 'tertiary' },
  }

function ProductRow({ product }: { product: SellerProductRow }) {
  const navigate = useNavigate()
  const publish = usePublishProduct()
  const remove = useDeleteProduct()
  const [confirming, setConfirming] = useState(false)

  const status = STATUS[product.status]

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-(--radius-marketplace) border p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate">{product.title}</p>
        <p className="text-xs opacity-60">
          /{product.slug} · actualizado {formatDate(product.updatedAt)}
        </p>
      </div>

      <Chip size="sm" variant={status.variant}>
        {status.label}
      </Chip>

      <div className="flex gap-1">
        {product.status === 'published' && (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Ver en el catálogo"
            onPress={() => window.open(`/p/${product.slug}`, '_blank', 'noopener')}
          >
            <EyeIcon size={16} />
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          aria-label="Editar"
          onPress={() => navigate(`/panel/productos/${product.id}`)}
        >
          <PencilSimpleIcon size={16} />
        </Button>

        {product.status !== 'published' && (
          <Button
            size="sm"
            variant="outline"
            isPending={publish.isPending}
            onPress={() =>
              publish.mutate(product.id, {
                onSuccess: () => toast.success('Publicado'),
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            Publicar
          </Button>
        )}

        {confirming ? (
          <>
            <Button
              size="sm"
              variant="danger"
              isPending={remove.isPending}
              onPress={() =>
                remove.mutate(product.id, {
                  onSuccess: () => toast.success('Producto eliminado'),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              Sí, eliminar
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setConfirming(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Eliminar"
            onPress={() => setConfirming(true)}
          >
            <TrashIcon size={16} />
          </Button>
        )}
      </div>
    </li>
  )
}

export function ProductsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  const products = useMyProducts(page)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl">Productos</h1>
        <Button variant="primary" onPress={() => navigate('/panel/productos/nuevo')}>
          <PlusIcon size={18} weight="bold" />
          Nuevo producto
        </Button>
      </div>

      {products.isPending && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-(--radius-marketplace)" />
          ))}
        </div>
      )}

      {products.isError && (
        <ErrorState message={errorMessage(products.error)} onRetry={() => products.refetch()} />
      )}

      {products.data && products.data.items.length === 0 && (
        <Empty
          title="Todavía no tienes productos"
          message="Un producto necesita al menos una variante con precio y existencias para poder publicarse."
          action={
            <Button
              variant="primary"
              className="mt-2"
              onPress={() => navigate('/panel/productos/nuevo')}
            >
              Crear el primero
            </Button>
          }
        />
      )}

      {products.data && products.data.items.length > 0 && (
        <>
          <ul className="space-y-3">
            {products.data.items.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </ul>
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
