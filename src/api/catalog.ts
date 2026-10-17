import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type {
  Paginated,
  ProductDetail,
  ProductListItem,
  SearchProductsDto,
} from '@marketplace/contracts'
import { api } from './client'

export type SearchParams = Partial<SearchProductsDto>

export interface PublicStore {
  id: string
  slug: string
  storeName: string
  description: string | null
  logoKey: string | null
  bannerKey: string | null
  ratingAvg: string | number | null
  ratingCount: number
  createdAt: string
}

export interface CategoryNode {
  id: string
  parentId: string | null
  name: string
  slug: string
}

export function useProducts(params: SearchParams) {
  return useQuery({
    queryKey: ['products', params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get<Paginated<ProductListItem>>('/products', { params })
      return data
    },
  })
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ['product', slug],
    enabled: Boolean(slug),
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<ProductDetail>(`/products/${slug}`)
      return data
    },
  })
}

export function useStore(slug: string | undefined) {
  return useQuery({
    queryKey: ['store', slug],
    enabled: Boolean(slug),
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<PublicStore>(`/sellers/${slug}`)
      return data
    },
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ items: CategoryNode[] }>('/categories')
      return data.items
    },
  })
}
