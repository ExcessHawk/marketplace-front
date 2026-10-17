import { Button, Chip, ListBox, Select, TextArea, TextField } from '@heroui/react'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  type DisputeReason,
  type DisputeStatus,
  type DisputeView,
} from '@marketplace/contracts'
import { useDisputeMessage, useResolveDispute, useWithdrawDispute } from '../api/disputes'
import { formatDate, formatPrice } from '../lib/format'
import { errorMessage } from '../lib/problem'

const STATUS_VARIANT: Record<DisputeStatus, 'primary' | 'secondary' | 'tertiary'> = {
  open: 'secondary',
  resolved_buyer: 'primary',
  resolved_seller: 'primary',
  withdrawn: 'tertiary',
}

const ROLE_LABELS = { buyer: 'Comprador', seller: 'Vendedor', platform: 'Plataforma' } as const

export function DisputeStatusChip({ status }: { status: DisputeStatus }) {
  return (
    <Chip size="sm" variant={STATUS_VARIANT[status]}>
      {DISPUTE_STATUS_LABELS[status]}
    </Chip>
  )
}

export function DisputeThread({
  dispute,
  canWithdraw = false,
  canResolve = false,
}: {
  dispute: DisputeView
  canWithdraw?: boolean
  canResolve?: boolean
}) {
  const send = useDisputeMessage()
  const withdraw = useWithdrawDispute()
  const resolve = useResolveDispute()

  const [body, setBody] = useState('')
  const [resolving, setResolving] = useState<'buyer' | 'seller' | null>(null)
  const [resolution, setResolution] = useState('')

  const isOpen = dispute.status === 'open'

  return (
    <div className="space-y-4 rounded-(--radius-marketplace) border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <DisputeStatusChip status={dispute.status} />
        <span className="text-sm">{DISPUTE_REASON_LABELS[dispute.reason as DisputeReason]}</span>
        <span className="text-xs opacity-60">
          {dispute.orderNumber} · {formatPrice(dispute.amountCents)} · abierta el{' '}
          {formatDate(dispute.createdAt)}
        </span>
      </div>

      <ul className="space-y-3">
        {dispute.messages.map((message) => (
          <li key={message.id} className="text-sm">
            <p className="text-xs opacity-60">
              <span className="font-medium opacity-100">{ROLE_LABELS[message.senderRole]}</span>
              {message.senderName ? ` · ${message.senderName}` : ''} ·{' '}
              {formatDate(message.createdAt)}
            </p>
            <p
              className={`mt-1 whitespace-pre-line rounded-(--radius-marketplace) p-3 ${
                message.senderRole === 'platform'
                  ? 'bg-(--color-default-200)'
                  : 'bg-(--color-default-100)'
              }`}
            >
              {message.body}
            </p>
          </li>
        ))}
      </ul>

      {isOpen ? (
        <div className="space-y-2">
          <TextField aria-label="Mensaje" value={body} onChange={setBody} fullWidth>
            <TextArea rows={2} placeholder="Escribe lo que necesites aclarar" />
          </TextField>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              isDisabled={body.trim().length === 0}
              isPending={send.isPending}
              onPress={() =>
                send.mutate(
                  { id: dispute.id, body: body.trim() },
                  {
                    onSuccess: () => setBody(''),
                    onError: (error) => toast.error(errorMessage(error)),
                  },
                )
              }
            >
              <PaperPlaneTiltIcon size={16} />
              Enviar
            </Button>

            {canWithdraw && (
              <Button
                size="sm"
                variant="ghost"
                isPending={withdraw.isPending}
                onPress={() =>
                  withdraw.mutate(dispute.id, {
                    onSuccess: () => toast.success('Aclaración retirada'),
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }
              >
                Retirar aclaración
              </Button>
            )}

            {canResolve && !resolving && (
              <>
                <Button size="sm" variant="outline" onPress={() => setResolving('buyer')}>
                  Resolver a favor del comprador
                </Button>
                <Button size="sm" variant="outline" onPress={() => setResolving('seller')}>
                  Resolver a favor del vendedor
                </Button>
              </>
            )}
          </div>

          {canResolve && resolving && (
            <div className="space-y-2 rounded-(--radius-marketplace) bg-(--color-default-100) p-3">
              <p className="text-sm">
                Resolviendo a favor del{' '}
                <strong>{resolving === 'buyer' ? 'comprador' : 'vendedor'}</strong>.
                {resolving === 'buyer'
                  ? ' El subpedido queda reembolsado y nunca se le paga al vendedor.'
                  : ' El pago al vendedor se libera en la siguiente corrida.'}
              </p>
              <TextField
                aria-label="Resolución"
                value={resolution}
                onChange={setResolution}
                fullWidth
              >
                <TextArea rows={3} placeholder="Por qué se resuelve así. Lo leen ambas partes." />
              </TextField>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  isDisabled={resolution.trim().length < 20}
                  isPending={resolve.isPending}
                  onPress={() =>
                    resolve.mutate(
                      { id: dispute.id, inFavorOf: resolving, resolution: resolution.trim() },
                      {
                        onSuccess: () => {
                          toast.success('Aclaración resuelta')
                          setResolving(null)
                          setResolution('')
                        },
                        onError: (error) => toast.error(errorMessage(error)),
                      },
                    )
                  }
                >
                  Confirmar resolución
                </Button>
                <Button size="sm" variant="ghost" onPress={() => setResolving(null)}>
                  Cancelar
                </Button>
                {resolution.trim().length < 20 && (
                  <span className="self-center text-xs opacity-60">Mínimo 20 caracteres.</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm opacity-70">
          Resuelta el {formatDate(dispute.resolvedAt)}. Ya no se puede escribir aquí.
        </p>
      )}
    </div>
  )
}

export function OpenDisputeForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (input: { reason: DisputeReason; description: string }) => void
  isPending: boolean
}) {
  const [reason, setReason] = useState<DisputeReason>('not_received')
  const [description, setDescription] = useState('')

  return (
    <div className="space-y-3 rounded-(--radius-marketplace) border p-4">
      <p className="text-sm opacity-70">
        Cuéntanos qué pasó. Lo lee el vendedor y, si no se arregla, la plataforma.
      </p>

      <Select
        aria-label="Motivo"
        selectedKey={reason}
        onSelectionChange={(key) => setReason(String(key) as DisputeReason)}
        fullWidth
      >
        <Select.Trigger className="rounded-(--radius-marketplace)">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {Object.entries(DISPUTE_REASON_LABELS).map(([id, label]) => (
              <ListBox.Item key={id} id={id} textValue={label}>
                {label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <TextField aria-label="Qué pasó" value={description} onChange={setDescription} fullWidth>
        <TextArea rows={4} placeholder="Describe el problema con el detalle que puedas." />
      </TextField>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          isDisabled={description.trim().length < 20}
          isPending={isPending}
          onPress={() => onSubmit({ reason, description: description.trim() })}
        >
          Abrir aclaración
        </Button>
        {description.trim().length < 20 && (
          <span className="text-xs opacity-60">Mínimo 20 caracteres.</span>
        )}
      </div>
    </div>
  )
}
