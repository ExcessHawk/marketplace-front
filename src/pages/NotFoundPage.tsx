import { Button } from '@heroui/react'
import { CompassIcon } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { Empty } from '../components/States'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <Empty
      icon={<CompassIcon size={40} weight="duotone" className="opacity-50" />}
      title="Esta página no existe"
      message="Puede que el enlace esté roto o que la página se haya movido."
      action={
        <Button variant="primary" onPress={() => navigate('/')} className="mt-2">
          Ir al catálogo
        </Button>
      }
    />
  )
}
