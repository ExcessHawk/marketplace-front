import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateProductDto,
  ReplaceShippingRatesDto,
  ShippingRateView,
  ReplaceVariantsDto,
  SellerProductDetail,
  CreateSellerDto,
  Paginated,
  ProductStatus,
  UpdateProductDto,
  UpdateSellerDto,
} from '@marketplace/contracts'
import { api } from './client'
import { useAuth } from '../stores/auth'
import { statusOf } from '../lib/problem'

export interface Store {
  id: string
  userId: string
  slug: string
  storeName: string
  description: string | null
  logoKey: string | null
  bannerKey: string | null
  status: 'pending' | 'active' | 'suspended'
  commissionBps: number
  ratingAvg: string | number | null
  ratingCount: number
  createdAt: string
  updatedAt: string
}

export interface SellerProductRow {
  id: string
  slug: string
  title: string
  status: ProductStatus
  publishedAt: string | null
  updatedAt: string
}

export const sellerKeys = {
  store: ['seller', 'store'] as const,
  products: (page: number) => ['seller', 'products', page] as const,
  product: (id: string) => ['seller', 'product', id] as const,
  shipping: ['seller', 'shipping'] as const,
}

export function useMyStore() {
  const status = useAuth((s) => s.status)

  return useQuery({
    queryKey: sellerKeys.store,
    enabled: status === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<Store>('/seller/me')
      return data
    },
  })
}

export function useOpenStore() {
  const refreshSession = useAuth((s) => s.refreshSession)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: CreateSellerDto) => {
      const { data } = await api.post<{ seller: Store; message: string }>('/seller/register', body)
      await refreshSession()
      return data
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: sellerKeys.store })
    },
  })
}

export function useUpdateStore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: UpdateSellerDto) => {
      const { data } = await api.patch<Store>('/seller/me', body)
      return data
    },
    onSuccess(data) {
      queryClient.setQueryData(sellerKeys.store, data)
    },
  })
}

export function useMyProducts(page: number, limit = 20) {
  const status = useAuth((s) => s.status)

  return useQuery({
    queryKey: sellerKeys.products(page),
    enabled: status === 'authenticated',
    retry: (count, error) => statusOf(error) !== 403 && count < 1,
    queryFn: async () => {
      const { data } = await api.get<Paginated<SellerProductRow>>('/seller/products', {
        params: { page, limit },
      })
      return data
    },
  })
}

function invalidateProducts(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['seller', 'products'] })
  queryClient.invalidateQueries({ queryKey: ['products'] })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: CreateProductDto) => {
      const { data } = await api.post<{ id: string; slug: string }>('/seller/products', body)
      return data
    },
    onSuccess: () => invalidateProducts(queryClient),
  })
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: UpdateProductDto) => {
      const { data } = await api.patch<SellerProductRow>(`/seller/products/${id}`, body)
      return data
    },
    onSuccess: () => invalidateProducts(queryClient),
  })
}

export function usePublishProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<SellerProductRow>(`/seller/products/${id}/publish`)
      return data
    },
    onSuccess: () => invalidateProducts(queryClient),
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/seller/products/${id}`)
    },
    onSuccess: () => invalidateProducts(queryClient),
  })
}

export function useSellerProduct(id: string | undefined) {
  return useQuery({
    queryKey: sellerKeys.product(id ?? ''),
    enabled: Boolean(id),
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<SellerProductDetail>(`/seller/products/${id}`)
      return data
    },
  })
}

export function useReplaceVariants(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: ReplaceVariantsDto) => {
      const { data } = await api.put<{ variants: SellerProductDetail['variants'] }>(
        `/seller/products/${id}/variants`,
        body,
      )
      return data
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: sellerKeys.product(id) })
      invalidateProducts(queryClient)
    },
  })
}

export function useShippingRates() {
  const status = useAuth((s) => s.status)

  return useQuery({
    queryKey: sellerKeys.shipping,
    enabled: status === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<{ rates: ShippingRateView[] }>('/seller/shipping')
      return data.rates
    },
  })
}

export function useReplaceShipping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: ReplaceShippingRatesDto) => {
      const { data } = await api.put<{ rates: ShippingRateView[] }>('/seller/shipping', body)
      return data.rates
    },
    onSuccess(rates) {
      queryClient.setQueryData(sellerKeys.shipping, rates)
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
