import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CartSummary, CartView } from '@marketplace/contracts'
import { api } from './client'
import { useAuth } from '../stores/auth'

export const cartKeys = {
  view: ['cart'] as const,
  summary: ['cart', 'summary'] as const,
}

export function useCart() {
  const status = useAuth((s) => s.status)
  return useQuery({
    queryKey: cartKeys.view,
    enabled: status === 'authenticated',
    staleTime: 0,
    queryFn: async () => {
      const { data } = await api.get<CartView>('/cart')
      return data
    },
  })
}

export function useCartSummary() {
  const status = useAuth((s) => s.status)
  return useQuery({
    queryKey: cartKeys.summary,
    enabled: status === 'authenticated',
    queryFn: async () => {
      const { data } = await api.get<CartSummary>('/cart/summary')
      return data
    },
  })
}

function writeCart(queryClient: ReturnType<typeof useQueryClient>, cart: CartView) {
  queryClient.setQueryData(cartKeys.view, cart)
  queryClient.setQueryData<CartSummary>(cartKeys.summary, {
    itemCount: cart.itemCount,
    subtotalCents: cart.subtotalCents,
  })
}

export function useAddToCart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { variantId: string; quantity?: number }) => {
      const { data } = await api.post<CartView>('/cart/items', {
        variantId: input.variantId,
        quantity: input.quantity ?? 1,
      })
      return data
    },
    onSuccess: (cart) => writeCart(queryClient, cart),
  })
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { data } = await api.patch<CartView>(`/cart/items/${id}`, { quantity })
      return data
    },
    onSuccess: (cart) => writeCart(queryClient, cart),
  })
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<CartView>(`/cart/items/${id}`)
      return data
    },
    onSuccess: (cart) => writeCart(queryClient, cart),
  })
}

export function useClearCart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<CartView>('/cart')
      return data
    },
    onSuccess: (cart) => writeCart(queryClient, cart),
  })
}
