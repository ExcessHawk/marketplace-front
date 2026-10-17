import { Chip } from '@heroui/react'
import {
  GearIcon,
  PackageIcon,
  ReceiptIcon,
  TruckIcon,
  WalletIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { NavLink, Outlet } from 'react-router-dom'
import { useMyStore } from '../api/seller'
import { ErrorState, FullPageSpinner } from '../components/States'
import { errorMessage } from '../lib/problem'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-(--radius-marketplace) px-3 py-2 text-sm transition ${
    isActive ? 'bg-(--color-default-100) font-medium' : 'opacity-70 hover:opacity-100'
  }`

export function SellerLayout() {
  const store = useMyStore()

  if (store.isPending) return <FullPageSpinner label="Cargando tu tienda…" />
  if (store.isError) {
    return (
      <ErrorState
        title="No se pudo abrir el panel"
        message={errorMessage(store.error)}
        onRetry={() => store.refetch()}
      />
    )
  }

  return (
    <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
      <aside className="space-y-4">
        <div>
          <h2 className="text-xl">{store.data.storeName}</h2>
          <div className="mt-1 flex items-center gap-2">
            <Chip size="sm" variant="secondary">
              /{store.data.slug}
            </Chip>
          </div>
        </div>

        <nav className="flex gap-1 md:flex-col">
          <NavLink to="/panel" end className={tabClass}>
            <PackageIcon size={18} />
            Productos
          </NavLink>
          <NavLink to="/panel/ventas" className={tabClass}>
            <ReceiptIcon size={18} />
            Ventas
          </NavLink>
          <NavLink to="/panel/aclaraciones" className={tabClass}>
            <WarningCircleIcon size={18} />
            Aclaraciones
          </NavLink>
          <NavLink to="/panel/pagos" className={tabClass}>
            <WalletIcon size={18} />
            Pagos
          </NavLink>
          <NavLink to="/panel/envios" className={tabClass}>
            <TruckIcon size={18} />
            Envíos
          </NavLink>
          <NavLink to="/panel/tienda" className={tabClass}>
            <GearIcon size={18} />
            Mi tienda
          </NavLink>
        </nav>
      </aside>

      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  )
}
