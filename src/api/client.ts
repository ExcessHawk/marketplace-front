import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import { errorMessage } from '../lib/problem'

const ACCESS_KEY = 'mkt.access'
const REFRESH_KEY = 'mkt.refresh'

export const tokenStore = {
  get access() {
    try {
      return localStorage.getItem(ACCESS_KEY)
    } catch {
      return null
    }
  },
  get refresh() {
    try {
      return localStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    try {
      localStorage.setItem(ACCESS_KEY, tokens.accessToken)
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
    } catch {
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    } catch {
    }
  },
}

let onUnauthenticated: () => void = () => {}

export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler
}

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.refresh
  if (!refreshToken) return null

  try {
    const { data } = await axios.post('/api/auth/refresh', { refreshToken })
    tokenStore.set(data.tokens)
    return data.tokens.accessToken as string
  } catch {
    tokenStore.clear()
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean }

    if (status === 401 && original && !original._retried) {
      original._retried = true
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null
      })
      const token = await refreshing
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
      onUnauthenticated()
      return Promise.reject(error)
    }

    if (status === 403) {
      toast.error(errorMessage(error, 'No tienes permiso para hacer eso'))
    } else if (status && status >= 500) {
      toast.error('Algo falló de nuestro lado. Intenta de nuevo.')
      console.error('[api]', status, error.config?.url)
    } else if (!error.response) {
      toast.error('No se pudo contactar al servidor.')
    }

    return Promise.reject(error)
  },
)
