import { Chip } from '@heroui/react'
import {
  ClipboardTextIcon,
  ShieldCheckIcon,
  StorefrontIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAdminStats } from '../api/admin'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-(--radius-marketplace) px-3 py-2 text-sm transition ${
    isActive ? 'bg-(--color-default-100) font-medium' : 'opacity-70 hover:opacity-100'
  }`

export function AdminLayout() {
  const stats = useAdminStats()
  const pending = stats.data?.sellers.pending ?? 0

  return (
    <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
      <aside className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon size={24} weight="duotone" />
          <h2 className="text-xl">Plataforma</h2>
        </div>

        <nav className="flex gap-1 md:flex-col">
          <NavLink to="/admin" end className={tabClass}>
            <StorefrontIcon size={18} />
            Tiendas
            {pending > 0 && (
              <Chip size="sm" variant="primary" className="ml-auto">
                {pending}
              </Chip>
            )}
          </NavLink>
          <NavLink to="/admin/aclaraciones" className={tabClass}>
            <WarningCircleIcon size={18} />
            Aclaraciones
          </NavLink>
          <NavLink to="/admin/bitacora" className={tabClass}>
            <ClipboardTextIcon size={18} />
            Bitácora
          </NavLink>
        </nav>

        {stats.data && (
          <dl className="space-y-1 border-t pt-4 text-sm opacity-70">
            <div className="flex justify-between">
              <dt>Tiendas activas</dt>
              <dd>{stats.data.sellers.active}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Suspendidas</dt>
              <dd>{stats.data.sellers.suspended}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Publicados</dt>
              <dd>{stats.data.products.published}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Usuarios</dt>
              <dd>{stats.data.users}</dd>
            </div>
          </dl>
        )}
      </aside>

      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  )
}
