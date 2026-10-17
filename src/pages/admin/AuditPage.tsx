import { Chip, Skeleton } from '@heroui/react'
import { useSearchParams } from 'react-router-dom'
import type { AuditEntry } from '@marketplace/contracts'
import { useAuditLog } from '../../api/admin'
import { Pager } from '../../components/Pager'
import { Empty, ErrorState } from '../../components/States'
import { errorMessage } from '../../lib/problem'

const ACTIONS: Record<string, string> = {
  'seller.approved': 'aprobó la tienda',
  'seller.suspended': 'suspendió la tienda',
  'admin.granted': 'recibió acceso de administrador',
  'admin.revoked': 'perdió el acceso de administrador',
}

const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

function reasonOf(entry: AuditEntry): string | null {
  const values = entry.newValues as Record<string, unknown> | null
  const reason = values?.reason ?? values?.note
  return typeof reason === 'string' && reason ? reason : null
}

function Entry({ entry }: { entry: AuditEntry }) {
  const values = entry.newValues as Record<string, unknown> | null
  const selfApproved = values?.selfApproved === true
  const viaCli = values?.via === 'cli'
  const subject = typeof values?.email === 'string' ? values.email : null
  const reason = reasonOf(entry)

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b py-3 text-sm last:border-0">
      <time className="w-40 shrink-0 tabular-nums opacity-60">
        {dateTime.format(new Date(entry.createdAt))}
      </time>

      <span className="font-medium">
        {entry.actor?.email ?? (viaCli ? 'Desde la terminal' : 'Cuenta eliminada')}
      </span>

      <span className="opacity-80">{ACTIONS[entry.action] ?? entry.action}</span>

      {subject && <span className="font-medium">{subject}</span>}

      {selfApproved && (
        <Chip size="sm" variant="tertiary">
          su propia tienda
        </Chip>
      )}

      {reason && <span className="w-full opacity-70">“{reason}”</span>}
    </li>
  )
}

export function AuditPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  const recordId = params.get('registro') ?? undefined

  const audit = useAuditLog(page, recordId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Bitácora</h1>
        <p className="text-sm opacity-60">
          Cada acción de plataforma se escribe en la misma transacción que el cambio. No se puede
          editar ni borrar desde aquí.
        </p>
      </div>

      {audit.isPending && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 rounded-(--radius-marketplace)" />
          ))}
        </div>
      )}

      {audit.isError && (
        <ErrorState message={errorMessage(audit.error)} onRetry={() => audit.refetch()} />
      )}

      {audit.data && audit.data.items.length === 0 && (
        <Empty title="Todavía no hay nada registrado" />
      )}

      {audit.data && audit.data.items.length > 0 && (
        <>
          <ul>
            {audit.data.items.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
          </ul>
          <Pager
            page={audit.data.page}
            totalPages={audit.data.totalPages}
            total={audit.data.total}
            onChange={(next) =>
              setParams((previous) => {
                const nextParams = new URLSearchParams(previous)
                nextParams.set('page', String(next))
                return nextParams
              })
            }
          />
        </>
      )}
    </div>
  )
}
