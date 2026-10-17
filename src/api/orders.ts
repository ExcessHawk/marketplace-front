import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AddressView,
  CheckoutResponse,
  CreateAddressDto,
  OrderListItem,
  OrderView,
  Paginated,
  SaleView,
  ShipSuborderDto,
  SellerEarnings,
  SuborderStatus,
} from '@marketplace/contracts'
import { api } from './client'
import { useAuth } from '../stores/auth'

export const orderKeys = {
  addresses: ['addresses'] as const,
  orders: (page: number) => ['orders', page] as const,
  order: (id: string) => ['order', id] as const,
  sales: (status: SuborderStatus | 'all', page: number) => ['seller', 'sales', status, page] as const,
  earnings: ['seller', 'earnings'] as const,
}

export function useAddresses() {
  const status = useAuth((s) => s.status)
  return useQuery({
    queryKey: orderKeys.addresses,
    enabled: status === 'authenticated',
    queryFn: async () => {
      const { data } = await api.get<{ items: AddressView[] }>('/addresses')
      return data.items
    },
  })
}

export function useCreateAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateAddressDto) => {
      const { data } = await api.post<AddressView>('/addresses', body)
      return data
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: orderKeys.addresses })
    },
  })
}

export function useDeleteAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/addresses/${id}`)
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: orderKeys.addresses })
    },
  })
}

export function useCheckout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (addressId: string) => {
      const { data } = await api.post<CheckoutResponse>('/checkout', { addressId })
      return data
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useSimulatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      intentId,
      outcome,
    }: {
      intentId: string
      outcome: 'succeeded' | 'failed'
    }) => {
      const { data } = await api.post<{ applied: boolean }>(`/webhooks/simulate/${intentId}`, {
        outcome,
      })
      return data
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useOrders(page: number) {
  const status = useAuth((s) => s.status)
  return useQuery({
    queryKey: orderKeys.orders(page),
    enabled: status === 'authenticated',
    queryFn: async () => {
      const { data } = await api.get<Paginated<OrderListItem>>('/orders', {
        params: { page, limit: 20 },
      })
      return data
    },
  })
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: orderKeys.order(id ?? ''),
    enabled: Boolean(id),
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<OrderView>(`/orders/${id}`)
      return data
    },
  })
}

export function useConfirmDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (suborderId: string) => {
      await api.post(`/suborders/${suborderId}/confirm`)
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useSales(status: SuborderStatus | 'all', page: number) {
  const session = useAuth((s) => s.status)
  return useQuery({
    queryKey: orderKeys.sales(status, page),
    enabled: session === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<Paginated<SaleView>>('/seller/sales', {
        params: { page, limit: 20, ...(status === 'all' ? {} : { status }) },
      })
      return data
    },
  })
}

export function useShipSuborder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: ShipSuborderDto & { id: string }) => {
      await api.post(`/suborders/${id}/ship`, body)
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['seller', 'sales'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'earnings'] })
    },
  })
}

export function useEarnings() {
  const status = useAuth((s) => s.status)

  return useQuery({
    queryKey: orderKeys.earnings,
    enabled: status === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<SellerEarnings>('/seller/payouts')
      return data
    },
  })
}
