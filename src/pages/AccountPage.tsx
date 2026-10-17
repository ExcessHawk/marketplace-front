import { Alert, Button, Card, Chip, Form } from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  UpdatePasswordSchema,
  UpdateProfileSchema,
  type UpdatePasswordDto,
  type UpdateProfileDto,
} from '@marketplace/contracts'
import { useUpdatePassword, useUpdateProfile } from '../api/auth'
import { TextInput } from '../components/Field'
import { useAuth } from '../stores/auth'
import { applyViolations, errorMessage, statusOf } from '../lib/problem'

function ProfileCard() {
  const user = useAuth((s) => s.user)
  const updateProfile = useUpdateProfile()

  const { control, handleSubmit, setError, formState, reset } = useForm<UpdateProfileDto>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: { fullName: user?.fullName ?? '', phone: user?.phone ?? '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const updated = await updateProfile.mutateAsync({
        fullName: values.fullName,
        phone: values.phone?.trim() ? values.phone.trim() : null,
      })
      reset({ fullName: updated.fullName, phone: updated.phone ?? '' })
      toast.success('Datos guardados')
    } catch (error) {
      if (!applyViolations(error, setError)) toast.error(errorMessage(error))
    }
  })

  return (
    <Card className="rounded-(--radius-marketplace)">
      <Card.Header>
        <Card.Title>Tus datos</Card.Title>
        <Card.Description>{user?.email}</Card.Description>
      </Card.Header>

      <Card.Content>
        <Form onSubmit={onSubmit} className="space-y-4">
          <TextInput control={control} name="fullName" label="Nombre completo" />
          <TextInput control={control} name="phone" type="tel" label="Teléfono" />
          <Button
            type="submit"
            variant="primary"
            isDisabled={!formState.isDirty}
            isPending={formState.isSubmitting}
          >
            Guardar
          </Button>
        </Form>
      </Card.Content>
    </Card>
  )
}

function PasswordCard() {
  const navigate = useNavigate()
  const signOut = useAuth((s) => s.signOut)
  const updatePassword = useUpdatePassword()

  const { control, handleSubmit, setError, formState } = useForm<UpdatePasswordDto>({
    resolver: zodResolver(UpdatePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updatePassword.mutateAsync(values)
      signOut()
      toast.success('Contraseña cambiada. Entra de nuevo.')
      navigate('/entrar', { replace: true })
    } catch (error) {
      if (!applyViolations(error, setError)) {
        if (statusOf(error) === 401) {
          setError('currentPassword', { message: 'Esa no es tu contraseña actual' })
        } else {
          toast.error(errorMessage(error))
        }
      }
    }
  })

  return (
    <Card className="rounded-(--radius-marketplace)">
      <Card.Header>
        <Card.Title>Contraseña</Card.Title>
        <Card.Description>
          Cambiarla cierra la sesión en todos tus dispositivos.
        </Card.Description>
      </Card.Header>

      <Card.Content>
        <Form onSubmit={onSubmit} className="space-y-4">
          <TextInput
            control={control}
            name="currentPassword"
            type="password"
            label="Contraseña actual"
            autoComplete="current-password"
            isRequired
          />
          <TextInput
            control={control}
            name="newPassword"
            type="password"
            label="Contraseña nueva"
            description="Mínimo 12 caracteres."
            autoComplete="new-password"
            isRequired
          />
          <Button type="submit" variant="secondary" isPending={formState.isSubmitting}>
            Cambiar contraseña
          </Button>
        </Form>
      </Card.Content>
    </Card>
  )
}

export function AccountPage() {
  const user = useAuth((s) => s.user)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl">Mi cuenta</h1>
        <div className="flex gap-1">
          {user?.roles.map((role) => (
            <Chip key={role} size="sm" variant="secondary">
              {role}
            </Chip>
          ))}
        </div>
      </div>

      {user && !user.sellerId && (
        <Alert status="accent">
          <Alert.Content>
            <Alert.Description>
              ¿Quieres vender aquí? Abre tu tienda desde el menú de tu cuenta.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <ProfileCard />
      <PasswordCard />
    </div>
  )
}
