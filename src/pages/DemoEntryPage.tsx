import { Button } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { DemoRoleDto, LoginResponse } from '@marketplace/contracts'
import { api } from '../api/client'
import { FullPageSpinner } from '../components/States'
import { errorMessage } from '../lib/problem'
import { useAuth } from '../stores/auth'

const LANDING: Record<DemoRoleDto, string> = {
  comprador: '/',
  vendedor: '/panel',
  admin: '/admin',
}

const LABEL: Record<DemoRoleDto, string> = {
  comprador: 'comprador',
  vendedor: 'vendedor',
  admin: 'administrador de la plataforma',
}

function isDemoRole(value: string | null): value is DemoRoleDto {
  return value === 'comprador' || value === 'vendedor' || value === 'admin'
}

export function DemoEntryPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const signIn = useAuth((s) => s.signIn)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const raw = params.get('rol')
  const role: DemoRoleDto = isDemoRole(raw) ? raw : 'comprador'

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const run = async () => {
      try {
        const { data } = await api.post<LoginResponse>('/demo/session', { role })
        signIn(data)
        navigate(LANDING[role], { replace: true })
      } catch (cause) {
        setError(errorMessage(cause))
      }
    }

    void run()
  }, [role, signIn, navigate])

  if (error) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl">La demostración no abrió</h1>
        <p className="text-sm opacity-70">{error}</p>
        <p className="text-sm opacity-70">
          Puedes entrar con una cuenta normal mientras tanto.
        </p>
        <Button variant="primary" onPress={() => navigate('/entrar')}>
          Ir a iniciar sesión
        </Button>
      </div>
    )
  }

  return <FullPageSpinner label={`Entrando como ${LABEL[role]}…`} />
}
