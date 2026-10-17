import { Button, Chip, Input, TextField } from '@heroui/react'
import { ChatCircleIcon, PaperPlaneTiltIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  useChatSocket,
  useConversation,
  useMarkRead,
  useSendMessage,
} from '../api/chat'
import { errorMessage, statusOf } from '../lib/problem'

const TIME = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' })

export function ChatPanel({ suborderId }: { suborderId: string }) {
  const [open, setOpen] = useState(false)
  const conversation = useConversation(suborderId, open)
  const socket = useChatSocket(suborderId, open)
  const send = useSendMessage(suborderId)
  const markRead = useMarkRead(suborderId)

  const [body, setBody] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)
  const readRef = useRef(false)

  const unread = conversation.data?.unreadCount ?? 0
  const messages = conversation.data?.messages ?? []

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  useEffect(() => {
    if (!open || readRef.current || unread === 0) return
    readRef.current = true
    markRead.mutate(undefined, { onSettled: () => (readRef.current = false) })
  }, [open, unread, markRead])

  if (!open) {
    return (
      <Button size="sm" variant="ghost" aria-label="Mensajes" onPress={() => setOpen(true)}>
        <ChatCircleIcon size={16} />
        Mensajes
        {unread > 0 && (
          <Chip size="sm" variant="primary">
            {unread}
          </Chip>
        )}
      </Button>
    )
  }

  if (conversation.isError) {
    const forbidden = statusOf(conversation.error) === 403
    return (
      <p className="py-2 text-sm opacity-70">
        {forbidden
          ? 'El chat se abre cuando el pedido está pagado.'
          : errorMessage(conversation.error)}
      </p>
    )
  }

  const submit = () => {
    const text = body.trim()
    if (!text) return
    setBody('')
    if (!socket.send(text)) {
      send.mutate(text, { onError: (error) => toast.error(errorMessage(error)) })
    }
  }

  return (
    <div className="space-y-2 rounded-(--radius-marketplace) border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm">
          {conversation.data?.counterpartName ?? 'Mensajes'}
          <span className="ml-2 text-xs opacity-60">
            {socket.state === 'open' ? 'en línea' : 'reconectando…'}
          </span>
        </p>
        <Button size="sm" variant="ghost" onPress={() => setOpen(false)}>
          Cerrar
        </Button>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="py-4 text-center text-sm opacity-60">
            Todavía no se han escrito. Pregunta lo que necesites.
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-(--radius-marketplace) px-3 py-2 text-sm ${
                message.isMine ? 'bg-(--color-default-200)' : 'bg-(--color-default-100)'
              }`}
            >
              <p className="whitespace-pre-line">{message.body}</p>
              <p className="mt-1 text-xs opacity-50">{TIME.format(new Date(message.createdAt))}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2">
        <TextField
          aria-label="Mensaje"
          value={body}
          onChange={setBody}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          fullWidth
        >
          <Input placeholder="Escribe un mensaje" />
        </TextField>
        <Button
          size="sm"
          variant="primary"
          aria-label="Enviar mensaje"
          isDisabled={body.trim().length === 0}
          isPending={send.isPending}
          onPress={submit}
        >
          <PaperPlaneTiltIcon size={16} />
        </Button>
      </div>
    </div>
  )
}
