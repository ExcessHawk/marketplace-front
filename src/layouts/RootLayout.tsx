import { Avatar, Button, Chip, Dropdown, Link as HeroLink } from '@heroui/react'
import {
  ChatCircleIcon,
  PackageIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SignOutIcon,
  StorefrontIcon,
  StorefrontIcon as StoreIcon,
  UserCircleIcon,
} from '@phosphor-icons/react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useLogout } from '../api/auth'
import { useCartSummary } from '../api/cart'
import { useChatUnread } from '../api/chat'
import { hasRole, useAuth } from '../stores/auth'

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function CartButton() {
  const navigate = useNavigate()
  const summary = useCartSummary()
  const count = summary.data?.itemCount ?? 0

  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={count ? `Carrito, ${count} artículos` : 'Carrito'}
      onPress={() => navigate('/carrito')}
    >
      <ShoppingCartIcon size={20} />
      {count > 0 && (
        <Chip size="sm" variant="primary">
          {count}
        </Chip>
      )}
    </Button>
  )
}

function MessagesButton() {
  const navigate = useNavigate()
  const unread = useChatUnread()
  const count = unread.data ?? 0

  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={count ? `Mensajes, ${count} sin leer` : 'Mensajes'}
      onPress={() => navigate('/mensajes')}
    >
      <ChatCircleIcon size={20} />
      {count > 0 && (
        <Chip size="sm" variant="primary">
          {count}
        </Chip>
      )}
    </Button>
  )
}

function SessionMenu() {
  const user = useAuth((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()

  if (!user) return null

  const isSeller = hasRole(user, 'seller')
  const isAdmin = hasRole(user, 'admin')

  return (
    <Dropdown>
      <Dropdown.Trigger aria-label="Tu cuenta">
        <Avatar size="sm">
          <Avatar.Fallback>{initials(user.fullName)}</Avatar.Fallback>
        </Avatar>
      </Dropdown.Trigger>

      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'logout') {
              navigate('/')
              logout.mutate()
              return
            }
            navigate(String(key))
          }}
        >
          <Dropdown.Item id="/pedidos" textValue="Mis pedidos">
            <PackageIcon size={18} />
            Mis pedidos
          </Dropdown.Item>
          <Dropdown.Item id="/cuenta" textValue="Mi cuenta">
            <UserCircleIcon size={18} />
            Mi cuenta
          </Dropdown.Item>
          <Dropdown.Item
            id={isSeller ? '/panel' : '/vender'}
            textValue={isSeller ? 'Panel de vendedor' : 'Vender aquí'}
          >
            <StoreIcon size={18} />
            {isSeller ? 'Panel de vendedor' : 'Vender aquí'}
          </Dropdown.Item>
          {isAdmin && (
            <Dropdown.Item id="/admin" textValue="Plataforma">
              <ShieldCheckIcon size={18} />
              Plataforma
            </Dropdown.Item>
          )}
          <Dropdown.Item id="logout" textValue="Salir">
            <SignOutIcon size={18} />
            Salir
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

export function RootLayout() {
  const status = useAuth((s) => s.status)
  const navigate = useNavigate()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b bg-(--color-background)/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <StorefrontIcon size={28} weight="duotone" />
            <span className="font-(family-name:--font-display) text-xl tracking-tight">
              Marketplace
            </span>
          </Link>

          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `hidden text-sm sm:block ${isActive ? '' : 'opacity-60 hover:opacity-100'}`
            }
          >
            Catálogo
          </NavLink>

          <div className="ml-auto flex items-center gap-2">
            {status === 'authenticated' ? (
              <>
                <MessagesButton />
                <CartButton />
                <SessionMenu />
              </>
            ) : status === 'anonymous' ? (
              <>
                <HeroLink href="/entrar" className="text-sm">
                  Entrar
                </HeroLink>
                <Button size="sm" variant="primary" onPress={() => navigate('/crear-cuenta')}>
                  Crear cuenta
                </Button>
              </>
            ) : null}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm opacity-60">
          Marketplace · precios en MXN, IVA incluido
        </div>
      </footer>
    </div>
  )
}
