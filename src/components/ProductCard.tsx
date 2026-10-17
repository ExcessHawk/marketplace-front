import { Card } from '@heroui/react'
import { ImageIcon } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import type { ProductListItem } from '@marketplace/contracts'
import { formatPrice } from '../lib/format'
import { RatingBadge } from './Rating'

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <Card className="overflow-hidden rounded-(--radius-marketplace) transition hover:shadow-lg">
      <Link to={`/p/${product.slug}`} className="block">
        <div className="flex aspect-4/3 items-center justify-center bg-(--color-default-100)">
          {product.imageKey ? (
            <img
              src={product.imageKey}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageIcon size={40} weight="duotone" className="opacity-30" />
          )}
        </div>

        <Card.Header>
          <Card.Title className="line-clamp-2 text-base">{product.title}</Card.Title>
          <Card.Description>{product.seller.storeName}</Card.Description>
        </Card.Header>

        <Card.Content className="space-y-1">
          <p className="text-2xl">
            {formatPrice(product.priceFromCents)}
            <span className="ml-1 align-middle text-xs opacity-60">desde</span>
          </p>
          <RatingBadge average={product.ratingAvg} count={product.ratingCount} />
        </Card.Content>
      </Link>
    </Card>
  )
}
