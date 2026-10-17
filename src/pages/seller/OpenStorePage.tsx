import { Alert, Button, Card, Form } from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { HourglassMediumIcon, StorefrontIcon } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CreateSellerSchema, type CreateSellerDto } from '@marketplace/contracts'
import { useOpenStore } from '../../api/seller'
import { TextAreaInput, TextInput } from '../../components/Field'
import { hasRole, useAuth } from '../../stores/auth'
import { applyViolations, errorMessage, statusOf } from '../../lib/problem'
import { slugify } from '../../lib/slug'

function PendingReview() {
  return (
    <Card className="mx-auto max-w-md rounded-(--radius-marketplace)">
      <Card.Header>
        <HourglassMediumIcon size={32} weight="duotone" className="opacity-70" />
        <Card.Title>Tu tienda está en revisión</Card.Title>
        <Card.Description>
          Revisamos cada tienda antes de abrirla al público. Te avisamos por correo en cuanto
          quede lista; entonces el panel de vendedor aparece solo.
        </Card.Description>
      </Card.Header>
    </Card>
  )
}

export function OpenStorePage() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const openStore = useOpenStore()

  const { control, handleSubmit, setError, setValue, watch, formState } = useForm<CreateSellerDto>({
    resolver: zodResolver(CreateSellerSchema),
    defaultValues: { storeName: '', slug: '', description: '' },
  })

  const storeName = watch('storeName')

  useEffect(() => {
    if (formState.dirtyFields.slug) return
    setValue('slug', slugify(storeName ?? ''))
  }, [storeName, formState.dirtyFields.slug, setValue])

  if (hasRole(user, 'seller') || hasRole(user, 'admin')) {
    return <Navigate to="/panel" replace />
  }

  if (user?.sellerId) return <PendingReview />

  const onSubmit = handleSubmit(async (values) => {
    try {
      await openStore.mutateAsync({
        ...values,
        description: values.description?.trim() || undefined,
      })
      toast.success('Tienda creada. Queda en revisión.')
      navigate('/vender', { replace: true })
    } catch (error) {
      if (!applyViolations(error, setError) && statusOf(error) !== 409) {
        toast.error(errorMessage(error))
      }
    }
  })

  const conflict = statusOf(openStore.error) === 409

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <StorefrontIcon size={32} weight="duotone" />
        <h1 className="text-3xl">Abre tu tienda</h1>
      </div>

      <Card className="rounded-(--radius-marketplace)">
        <Card.Content className="pt-6">
          <Form onSubmit={onSubmit} className="space-y-4">
            {conflict && (
              <Alert status="warning">
                <Alert.Content>
                  <Alert.Description>{errorMessage(openStore.error)}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <TextInput
              control={control}
              name="storeName"
              label="Nombre de la tienda"
              autoFocus
              isRequired
            />
            <TextInput
              control={control}
              name="slug"
              label="Dirección"
              description={`marketplace.mx/t/${watch('slug') || 'tu-tienda'} — no se puede cambiar después.`}
              isRequired
            />
            <TextAreaInput
              control={control}
              name="description"
              label="Qué vendes"
              description="Opcional. Lo ve quien entra a tu tienda."
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isPending={formState.isSubmitting || openStore.isPending}
            >
              Crear tienda
            </Button>
          </Form>
        </Card.Content>
      </Card>

      <p className="text-center text-sm opacity-60">
        Revisamos cada tienda antes de abrirla al público.
      </p>
    </div>
  )
}
