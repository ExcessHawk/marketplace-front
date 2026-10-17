import { Breadcrumbs, Button, Chip, Skeleton } from '@heroui/react'
import { ImageIcon, ShoppingCartIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAddToCart } from '../api/cart'
import { useProduct } from '../api/catalog'
import { useAuth } from '../stores/auth'
import { ErrorState } from '../components/States'
import { formatPrice } from '../lib/format'
import { errorMessage, statusOf } from '../lib/problem'
import { RatingBadge } from '../components/Rating'
import { ProductReviews } from '../components/Reviews'

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const sessionStatus = useAuth((s) => s.status)
  const product = useProduct(slug)
  const addToCart = useAddToCart()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const variants = product.data?.variants ?? []

  const selected = useMemo(() => {
    if (!variants.length) return null
    if (selectedId) return variants.find((v) => v.id === selectedId) ?? variants[0]
    const inStock = variants.filter((v) => v.stock > 0)
    const pool = inStock.length ? inStock : variants
    return pool.reduce((cheapest, v) => (v.priceCents < cheapest.priceCents ? v : cheapest))
  }, [variants, selectedId])

  if (product.isPending) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-square rounded-(--radius-marketplace)" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  if (product.isError) {
    const notFound = statusOf(product.error) === 404
    return (
      <ErrorState
        title={notFound ? 'Este producto ya no está' : 'No se pudo cargar el producto'}
        message={
          notFound
            ? 'Puede que el vendedor lo haya despublicado. Busca algo parecido en el catálogo.'
            : errorMessage(product.error)
        }
        onRetry={notFound ? undefined : () => product.refetch()}
      />
    )
  }

  const { title, description, seller, imageKey } = product.data
  const image = selected?.imageKeys?.[0] ?? imageKey

  return (
    <div className="space-y-8">
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Link to="/">Catálogo</Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Link to={`/t/${seller.slug}`}>{seller.storeName}</Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>{title}</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-(--radius-marketplace) bg-(--color-default-100)">
          {image ? (
            <img src={image} alt={title} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={64} weight="duotone" className="opacity-30" />
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl">{title}</h1>
            <Link to={`/t/${seller.slug}`} className="text-sm underline-offset-4 hover:underline">
              {seller.storeName}
            </Link>
            <div className="mt-1">
              <RatingBadge
                average={product.data.ratingAvg}
                count={product.data.ratingCount}
                size={16}
              />
            </div>
          </div>

          {selected && (
            <div className="flex items-baseline gap-3">
              <p className="text-4xl">{formatPrice(selected.priceCents)}</p>
              {selected.compareAtCents != null && selected.compareAtCents > selected.priceCents && (
                <p className="text-lg line-through opacity-50">
                  {formatPrice(selected.compareAtCents)}
                </p>
              )}
            </div>
          )}

          {variants.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm opacity-70">Opciones</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((variant) => {
                  const isSelected = selected?.id === variant.id
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedId(variant.id)}
                      disabled={variant.stock === 0}
                      className={`rounded-(--radius-marketplace) border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected ? 'border-current font-medium' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {variant.name}
                      <span className="ml-2 opacity-60">{formatPrice(variant.priceCents)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {selected &&
            (selected.stock > 0 ? (
              <Chip size="sm" variant="secondary">
                {selected.stock} disponibles
              </Chip>
            ) : (
              <Chip size="sm" variant="tertiary">
                Agotado
              </Chip>
            ))}

          <div className="space-y-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              isDisabled={!selected || selected.stock === 0}
              isPending={addToCart.isPending}
              onPress={() => {
                if (!selected) return
                if (sessionStatus !== 'authenticated') {
                  navigate('/entrar', { state: { from: location } })
                  return
                }
                addToCart.mutate(
                  { variantId: selected.id },
                  {
                    onSuccess: () => toast.success('Agregado al carrito'),
                    onError: (error) => toast.error(errorMessage(error)),
                  },
                )
              }}
            >
              <ShoppingCartIcon size={20} weight="bold" />
              {selected?.stock === 0 ? 'Agotado' : 'Agregar al carrito'}
            </Button>
            {sessionStatus === 'anonymous' && (
              <p className="text-center text-xs opacity-60">
                Te pedimos entrar para guardarlo.
              </p>
            )}
          </div>

          {description && (
            <div className="max-w-none whitespace-pre-line border-t pt-6 text-sm leading-relaxed opacity-80">
              {description}
            </div>
          )}
        </div>
      </div>

      <ProductReviews slug={product.data.slug} />
    </div>
  )
}
