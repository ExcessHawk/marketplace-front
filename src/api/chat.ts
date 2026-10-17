import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type {
  ChatMessageView,
  ChatTicket,
  ConversationSummary,
  ConversationView,
  SocketEvent,
} from '@marketplace/contracts'
import { api } from './client'
import { useAuth } from '../stores/auth'

export const chatKeys = {
  inbox: ['chat', 'inbox'] as const,
  unread: ['chat', 'unread'] as const,
  conversation: (suborderId: string) => ['chat', suborderId] as const,
}

export function useConversation(suborderId: string | undefined, enabled = true) {
  const status = useAuth((s) => s.status)
  return useQuery({
    queryKey: chatKeys.conversation(suborderId ?? ''),
    enabled: Boolean(suborderId) && enabled && status === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<ConversationView>(`/chat/${suborderId}`)
      return data
    },
  })
}

export function useChatInbox() {
  const status = useAuth((s) => s.status)
  return useQuery({
    queryKey: chatKeys.inbox,
    enabled: status === 'authenticated',
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<{ items: ConversationSummary[] }>('/chat')
      return data.items
    },
  })
}

export function useChatUnread() {
  const status = useAuth((s) => s.status)
  return useQuery({
    queryKey: chatKeys.unread,
    enabled: status === 'authenticated',
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ total: number }>('/chat/unread')
      return data.total
    },
  })
}

export function useSendMessage(suborderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) => {
      const { data } = await api.post<ChatMessageView>(`/chat/${suborderId}`, { body })
      return data
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversation(suborderId) })
      queryClient.invalidateQueries({ queryKey: chatKeys.inbox })
    },
  })
}

export function useMarkRead(suborderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post(`/chat/${suborderId}/read`)
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversation(suborderId) })
      queryClient.invalidateQueries({ queryKey: chatKeys.unread })
      queryClient.invalidateQueries({ queryKey: chatKeys.inbox })
    },
  })
}

type SocketState = 'idle' | 'connecting' | 'open' | 'closed'

export function useChatSocket(suborderId: string | undefined, enabled: boolean) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<SocketState>('idle')
  const socketRef = useRef<WebSocket | null>(null)
  const retryRef = useRef(0)

  useEffect(() => {
    if (!suborderId || !enabled) return

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const connect = async () => {
      if (cancelled) return
      setState('connecting')

      let ticket: ChatTicket
      try {
        const { data } = await api.post<ChatTicket>(`/chat/${suborderId}/ticket`)
        ticket = data
      } catch {
        setState('closed')
        return
      }
      if (cancelled) return

      const base = window.location.origin.replace(/^http/, 'ws')
      const socket = new WebSocket(`${base}${ticket.url}`)
      socketRef.current = socket

      socket.addEventListener('open', () => {
        retryRef.current = 0
        setState('open')
      })

      socket.addEventListener('message', (event) => {
        let parsed: SocketEvent
        try {
          parsed = JSON.parse(event.data)
        } catch {
          return
        }

        if (parsed.type === 'message') {
          queryClient.setQueryData<ConversationView>(
            chatKeys.conversation(suborderId),
            (previous) => {
              if (!previous) return previous
              if (previous.messages.some((m) => m.id === parsed.message.id)) return previous
              const isMine = parsed.message.senderRole === previous.myRole
              return {
                ...previous,
                messages: [...previous.messages, { ...parsed.message, isMine }],
                lastMessageAt: parsed.message.createdAt,
              }
            },
          )
          queryClient.invalidateQueries({ queryKey: chatKeys.inbox })
        }
      })

      socket.addEventListener('close', () => {
        socketRef.current = null
        setState('closed')
        if (cancelled) return
        const wait = Math.min(1000 * 2 ** retryRef.current, 15_000)
        retryRef.current += 1
        retryTimer = setTimeout(connect, wait)
      })
    }

    void connect()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [suborderId, enabled, queryClient])

  const send = (body: string) => {
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'message', body }))
      return true
    }
    return false
  }

  return { state, send }
}
