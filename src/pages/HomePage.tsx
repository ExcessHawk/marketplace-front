import { ListBox, SearchField, Select } from '@heroui/react'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SearchProductsDto } from '@marketplace/contracts'
import { useCategories, useProducts } from '../api/catalog'
import { Pager } from '../components/Pager'
import { ProductCard } from '../components/ProductCard'
import { CardGridSkeleton, Empty, ErrorState } from '../components/States'
import { errorMessage } from '../lib/problem'

type Sort = SearchProductsDto['sort']

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: 'relevance', label: 'Relevancia' },
  { id: 'newest', label: 'Más recientes' },
  { id: 'price_asc', label: 'Precio: menor a mayor' },
  { id: 'price_desc', label: 'Precio: mayor a menor' },
]

const PAGE_SIZE = 12

export function HomePage() {
  const [params, setParams] = useSearchParams()

  const q = params.get('q') ?? ''
  const category = params.get('category') ?? undefined
  const sort = (params.get('sort') as Sort | null) ?? 'relevance'
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

  const categories = useCategories()
  const products = useProducts({
    q: q || undefined,
    category,
    sort,
    page,
    limit: PAGE_SIZE,
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchField
          aria-label="Buscar productos"
          value={draft}
          onChange={setDraft}
          className="flex-1"
        >
          <SearchField.Group className="rounded-(--radius-marketplace)">
            <MagnifyingGlassIcon size={18} />
            <SearchField.Input placeholder="Busca piñatas, barro, talavera…" />
          </SearchField.Group>
        </SearchField>

        <Select
          aria-label="Ordenar por"
          selectedKey={sort}
          onSelectionChange={(key) => patch('sort', String(key))}
          className="sm:w-56"
        >
          <Select.Trigger className="rounded-(--radius-marketplace)">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {SORTS.map((option) => (
                <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                  {option.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {categories.data && categories.data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => patch('category', undefined)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              category ? 'opacity-60 hover:opacity-100' : 'bg-(--color-default-100) font-medium'
            }`}
          >
            Todo
          </button>
          {categories.data.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => patch('category', node.slug)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                category === node.slug
                  ? 'bg-(--color-default-100) font-medium'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              {node.name}
            </button>
          ))}
        </div>
      )}

      {products.isPending && <CardGridSkeleton count={PAGE_SIZE} />}

      {products.isError && (
        <ErrorState message={errorMessage(products.error)} onRetry={() => products.refetch()} />
      )}

      {products.data && products.data.items.length === 0 && (
        <Empty
          title="Todavía no hay nada aquí"
          message={
            q || category
              ? 'Ningún producto coincide con esos filtros. Prueba con menos.'
              : 'Publica el primer producto desde el panel de vendedor.'
          }
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
            onChange={(next) => patch('page', String(next))}
          />
        </>
      )}
    </div>
  )
}
