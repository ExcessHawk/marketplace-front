import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateReviewDto,
  Paginated,
  RatingSummary,
  ReviewView,
  ReviewableItem,
  UpdateReviewDto,
} from '@marketplace/contracts'
import { api } from './client'
import { useAuth } from '../stores/auth'

export const reviewKeys = {
  product: (slug: string, page: number) => ['reviews', 'product', slug, page] as const,
  summary: (slug: string) => ['reviews', 'summary', slug] as const,
  seller: (slug: string, page: number) => ['reviews', 'seller', slug, page] as const,
  suborder: (id: string) => ['reviews', 'suborder', id] as const,
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['reviews'] })
  queryClient.invalidateQueries({ queryKey: ['products'] })
  queryClient.invalidateQueries({ queryKey: ['product'] })
  queryClient.invalidateQueries({ queryKey: ['store'] })
}

export function useProductReviews(slug: string | undefined, page: number) {
  return useQuery({
    queryKey: reviewKeys.product(slug ?? '', page),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await api.get<Paginated<ReviewView>>(`/products/${slug}/reviews`, {
        params: { page, limit: 10 },
      })
      return data
    },
  })
}

export function useProductRatingSummary(slug: string | undefined) {
  return useQuery({
    queryKey: reviewKeys.summary(slug ?? ''),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await api.get<RatingSummary>(`/products/${slug}/reviews/summary`)
      return data
    },
  })
}

export function useSellerReviews(slug: string | undefined, page: number) {
  return useQuery({
    queryKey: reviewKeys.seller(slug ?? '', page),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await api.get<Paginated<ReviewView>>(`/sellers/${slug}/reviews`, {
        params: { page, limit: 10 },
      })
      return data
    },
  })
}

export function useReviewable(suborderId: string | undefined) {
  const status = useAuth((s) => s.status)
  return useQuery({
    queryKey: reviewKeys.suborder(suborderId ?? ''),
    enabled: Boolean(suborderId) && status === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<{ canReview: boolean; items: ReviewableItem[] }>(
        `/suborders/${suborderId}/reviews`,
      )
      return data
    },
  })
}

export function useCreateReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ suborderId, ...body }: CreateReviewDto & { suborderId: string }) => {
      const { data } = await api.post<ReviewView>(`/suborders/${suborderId}/reviews`, body)
      return data
    },
    onSuccess: () => invalidate(queryClient),
  })
}

export function useUpdateReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateReviewDto & { id: string }) => {
      const { data } = await api.patch<ReviewView>(`/reviews/${id}`, body)
      return data
    },
    onSuccess: () => invalidate(queryClient),
  })
}

export function useDeleteReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/reviews/${id}`)
    },
    onSuccess: () => invalidate(queryClient),
  })
}

export function useReplyReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      const { data } = await api.post<ReviewView>(`/reviews/${id}/reply`, { reply })
      return data
    },
    onSuccess: () => invalidate(queryClient),
  })
}
