import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminSellerRow,
  AdminStats,
  AuditEntry,
  Paginated,
  SellerStatusEnum,
} from '@marketplace/contracts'
import { z } from 'zod'
import { api } from './client'
import { useAuth } from '../stores/auth'

export type SellerStatus = z.infer<typeof SellerStatusEnum>

export const adminKeys = {
  stats: ['admin', 'stats'] as const,
  sellers: (status: SellerStatus | 'all', q: string, page: number) =>
    ['admin', 'sellers', status, q, page] as const,
  audit: (page: number, recordId?: string) => ['admin', 'audit', page, recordId ?? null] as const,
  admins: ['admin', 'admins'] as const,
}

export function useAdminStats() {
  const status = useAuth((s) => s.status)
  return useQuery({
    queryKey: adminKeys.stats,
    enabled: status === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<AdminStats>('/admin/stats')
      return data
    },
  })
}

export function useAdminSellers(status: SellerStatus | 'all', q: string, page: number) {
  const session = useAuth((s) => s.status)
  return useQuery({
    queryKey: adminKeys.sellers(status, q, page),
    enabled: session === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<Paginated<AdminSellerRow>>('/admin/sellers', {
        params: {
          page,
          limit: 20,
          ...(status === 'all' ? {} : { status }),
          ...(q ? { q } : {}),
        },
      })
      return data
    },
  })
}

export function useAuditLog(page: number, recordId?: string) {
  const session = useAuth((s) => s.status)
  return useQuery({
    queryKey: adminKeys.audit(page, recordId),
    enabled: session === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<Paginated<AuditEntry>>('/admin/audit', {
        params: { page, limit: 25, ...(recordId ? { recordId } : {}) },
      })
      return data
    },
  })
}

function invalidateAdmin(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin'] })
  queryClient.invalidateQueries({ queryKey: ['products'] })
  queryClient.invalidateQueries({ queryKey: ['store'] })
}

export function useApproveSeller() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const { data } = await api.post<AdminSellerRow>(`/admin/sellers/${id}/approve`, { note })
      return data
    },
    onSuccess: () => invalidateAdmin(queryClient),
  })
}

export function useSuspendSeller() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await api.post<AdminSellerRow>(`/admin/sellers/${id}/suspend`, { reason })
      return data
    },
    onSuccess: () => invalidateAdmin(queryClient),
  })
}
