import { create } from 'zustand'
import type { AuthUser, LoginResponse, Role } from '@marketplace/contracts'
import { api, setUnauthenticatedHandler, tokenStore } from '../api/client'

export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous'

interface AuthState {
  user: AuthUser | null
  status: SessionStatus
  signIn: (response: LoginResponse) => void
  signOut: () => void
  setUser: (user: AuthUser) => void
  bootstrap: () => Promise<void>
  refreshSession: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'unknown',

  signIn(response) {
    tokenStore.set(response.tokens)
    set({ user: response.user, status: 'authenticated' })
  },

  signOut() {
    tokenStore.clear()
    set({ user: null, status: 'anonymous' })
  },

  setUser(user) {
    set({ user })
  },

  async bootstrap() {
    if (!tokenStore.access && !tokenStore.refresh) {
      set({ user: null, status: 'anonymous' })
      return
    }
    try {
      const { data } = await api.get<AuthUser>('/auth/me')
      set({ user: data, status: 'authenticated' })
    } catch {
      tokenStore.clear()
      set({ user: null, status: 'anonymous' })
    }
  },

  async refreshSession() {
    const refreshToken = tokenStore.refresh
    if (!refreshToken) return
    const { data } = await api.post<LoginResponse>('/auth/refresh', { refreshToken })
    tokenStore.set(data.tokens)
    set({ user: data.user, status: 'authenticated' })
  },
}))

setUnauthenticatedHandler(() => {
  useAuth.setState({ user: null, status: 'anonymous' })
})

export function hasRole(user: AuthUser | null, role: Role): boolean {
  return user?.roles.includes(role) ?? false
}
