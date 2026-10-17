import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  DisputeStatus,
  DisputeView,
  OpenDisputeDto,
  Paginated,
  ResolveDisputeDto,
} from '@marketplace/contracts'
import { api } from './client'
import { useAuth } from '../stores/auth'

export const disputeKeys = {
  forSuborder: (id: string) => ['dispute', 'suborder', id] as const,
  detail: (id: string) => ['dispute', id] as const,
  sellerList: (status: DisputeStatus | 'all', page: number) =>
    ['seller', 'disputes', status, page] as const,
  adminList: (status: DisputeStatus | 'all', page: number) =>
    ['admin', 'disputes', status, page] as const,
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['dispute'] })
  queryClient.invalidateQueries({ queryKey: ['seller', 'disputes'] })
  queryClient.invalidateQueries({ queryKey: ['admin', 'disputes'] })
  queryClient.invalidateQueries({ queryKey: ['seller', 'earnings'] })
  queryClient.invalidateQueries({ queryKey: ['order'] })
}

export function useSuborderDispute(suborderId: string | undefined) {
  const status = useAuth((s) => s.status)
  return useQuery({
    queryKey: disputeKeys.forSuborder(suborderId ?? ''),
    enabled: Boolean(suborderId) && status === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<{ dispute: DisputeView | null }>(
        `/suborders/${suborderId}/dispute`,
      )
      return data.dispute
    },
  })
}

export function useOpenDispute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ suborderId, ...body }: OpenDisputeDto & { suborderId: string }) => {
      const { data } = await api.post<DisputeView>(`/suborders/${suborderId}/dispute`, body)
      return data
    },
    onSuccess: () => invalidate(queryClient),
  })
}

export function useDisputeMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { data } = await api.post<DisputeView>(`/disputes/${id}/messages`, { body })
      return data
    },
    onSuccess: () => invalidate(queryClient),
  })
}

export function useWithdrawDispute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<DisputeView>(`/disputes/${id}/withdraw`)
      return data
    },
    onSuccess: () => invalidate(queryClient),
  })
}

export function useResolveDispute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: ResolveDisputeDto & { id: string }) => {
      const { data } = await api.post<DisputeView>(`/admin/disputes/${id}/resolve`, body)
      return data
    },
    onSuccess: () => invalidate(queryClient),
  })
}

export function useSellerDisputes(status: DisputeStatus | 'all', page: number, enabled = true) {
  const session = useAuth((s) => s.status)
  return useQuery({
    queryKey: disputeKeys.sellerList(status, page),
    enabled: enabled && session === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<Paginated<DisputeView>>('/seller/disputes', {
        params: { page, limit: 20, ...(status === 'all' ? {} : { status }) },
      })
      return data
    },
  })
}

export function useAdminDisputes(status: DisputeStatus | 'all', page: number, enabled = true) {
  const session = useAuth((s) => s.status)
  return useQuery({
    queryKey: disputeKeys.adminList(status, page),
    enabled: enabled && session === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<Paginated<DisputeView>>('/admin/disputes', {
        params: { page, limit: 20, ...(status === 'all' ? {} : { status }) },
      })
      return data
    },
  })
}
