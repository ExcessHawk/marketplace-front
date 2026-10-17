import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AuthUser,
  LoginDto,
  LoginResponse,
  RegisterDto,
  UpdatePasswordDto,
  UpdateProfileDto,
} from '@marketplace/contracts'
import { api } from './client'
import { useAuth } from '../stores/auth'

export function useLogin() {
  const signIn = useAuth((s) => s.signIn)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: LoginDto) => {
      const { data } = await api.post<LoginResponse>('/auth/login', body)
      return data
    },
    onSuccess(data) {
      signIn(data)
      queryClient.clear()
    },
  })
}

export function useRegister() {
  const signIn = useAuth((s) => s.signIn)

  return useMutation({
    mutationFn: async (body: RegisterDto) => {
      const { data } = await api.post<LoginResponse>('/auth/register', body)
      return data
    },
    onSuccess: signIn,
  })
}

export function useLogout() {
  const signOut = useAuth((s) => s.signOut)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout').catch(() => undefined)
    },
    onSettled() {
      signOut()
      queryClient.clear()
    },
  })
}

export function useUpdateProfile() {
  const setUser = useAuth((s) => s.setUser)

  return useMutation({
    mutationFn: async (body: UpdateProfileDto) => {
      const { data } = await api.patch<AuthUser>('/auth/profile', body)
      return data
    },
    onSuccess: setUser,
  })
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (body: UpdatePasswordDto) => {
      const { data } = await api.patch<{ message: string }>('/auth/password', body)
      return data
    },
  })
}
