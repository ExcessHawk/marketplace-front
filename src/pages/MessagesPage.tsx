import { Button, Chip, Skeleton } from '@heroui/react'
import { ChatCircleIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatInbox } from '../api/chat'
import { ChatPanel } from '../components/ChatPanel'
import { Empty, ErrorState } from '../components/States'
import { formatDate } from '../lib/format'
import { errorMessage } from '../lib/problem'

export function MessagesPage() {
  const navigate = useNavigate()
  const inbox = useChatInbox()
  const [openId, setOpenId] = useState<string | null>(null)

  if (inbox.isPending) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-(--radius-marketplace)" />
        ))}
      </div>
    )
  }

  if (inbox.isError) {
    return <ErrorState message={errorMessage(inbox.error)} onRetry={() => inbox.refetch()} />
  }

  if (inbox.data.length === 0) {
    return (
      <Empty
        icon={<ChatCircleIcon size={40} weight="duotone" className="opacity-50" />}
        title="No tienes conversaciones"
        message="El chat se abre con cada pedido pagado, para hablar con la tienda."
        action={
          <Button variant="primary" className="mt-2" onPress={() => navigate('/pedidos')}>
            Ver mis pedidos
          </Button>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl">Mensajes</h1>

      <ul className="space-y-3">
        {inbox.data.map((conversation) => (
          <li key={conversation.id} className="rounded-(--radius-marketplace) border p-4">
            <button
              type="button"
              onClick={() =>
                setOpenId(openId === conversation.suborderId ? null : conversation.suborderId)
              }
              className="flex w-full flex-wrap items-center gap-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  {conversation.counterpartName}
                  {conversation.unreadCount > 0 && (
                    <Chip size="sm" variant="primary">
                      {conversation.unreadCount}
                    </Chip>
                  )}
                </p>
                <p className="truncate text-xs opacity-60">
                  {conversation.orderNumber}
                  {conversation.lastMessageBody ? ` · ${conversation.lastMessageBody}` : ''}
                </p>
              </div>
              <span className="text-xs opacity-60">{formatDate(conversation.lastMessageAt)}</span>
            </button>

            {openId === conversation.suborderId && (
              <div className="pt-3">
                <ChatPanel suborderId={conversation.suborderId} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
