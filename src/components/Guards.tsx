import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { hasRole, useAuth } from '../stores/auth'
import { FullPageSpinner } from './States'

export function RequireAuth() {
  const status = useAuth((s) => s.status)
  const location = useLocation()

  if (status === 'unknown') return <FullPageSpinner label="Verificando sesión…" />

  if (status === 'anonymous') {
    return <Navigate to="/entrar" state={{ from: location }} replace />
  }

  return <Outlet />
}

export function RequireSeller() {
  const status = useAuth((s) => s.status)
  const user = useAuth((s) => s.user)
  const location = useLocation()

  if (status === 'unknown') return <FullPageSpinner label="Verificando sesión…" />
  if (status === 'anonymous') return <Navigate to="/entrar" state={{ from: location }} replace />

  if (!hasRole(user, 'seller') && !hasRole(user, 'admin')) {
    return <Navigate to="/vender" replace />
  }

  return <Outlet />
}

export function RequireAdmin() {
  const status = useAuth((s) => s.status)
  const user = useAuth((s) => s.user)
  const location = useLocation()

  if (status === 'unknown') return <FullPageSpinner label="Verificando sesión…" />
  if (status === 'anonymous') return <Navigate to="/entrar" state={{ from: location }} replace />

  if (!hasRole(user, 'admin')) return <Navigate to="/no-encontrado" replace />

  return <Outlet />
}

export function RedirectIfAuthenticated() {
  const status = useAuth((s) => s.status)

  if (status === 'unknown') return <FullPageSpinner />
  if (status === 'authenticated') return <Navigate to="/" replace />

  return <Outlet />
}
