import { Alert, Button, Card, Form, Link as HeroLink } from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { RegisterSchema, type RegisterDto } from '@marketplace/contracts'
import { useRegister } from '../api/auth'
import { TextInput } from '../components/Field'
import { applyViolations, errorMessage, statusOf } from '../lib/problem'

export function RegisterPage() {
  const navigate = useNavigate()
  const register = useRegister()

  const { control, handleSubmit, setError, formState } = useForm<RegisterDto>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { email: '', password: '', fullName: '', phone: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await register.mutateAsync({ ...values, phone: values.phone?.trim() || undefined })
      navigate('/', { replace: true })
    } catch (error) {
      applyViolations(error, setError)
    }
  })

  const emailTaken = statusOf(register.error) === 409

  return (
    <div className="mx-auto max-w-md">
      <Card className="rounded-(--radius-marketplace)">
        <Card.Header>
          <Card.Title className="text-2xl">Crear cuenta</Card.Title>
          <Card.Description>
            Una sola cuenta: compras con ella y, si quieres, vendes con ella.
          </Card.Description>
        </Card.Header>

        <Card.Content>
          <Form onSubmit={onSubmit} className="space-y-4">
            {register.isError && !emailTaken && (
              <Alert status="danger">
                <Alert.Content>
                  <Alert.Description>{errorMessage(register.error)}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            {emailTaken && (
              <Alert status="warning">
                <Alert.Content>
                  <Alert.Description>
                    Ya hay una cuenta con ese correo.{' '}
                    <Link to="/entrar" className="underline">
                      Entra aquí
                    </Link>
                    .
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <TextInput
              control={control}
              name="fullName"
              label="Nombre completo"
              autoComplete="name"
              autoFocus
              isRequired
            />
            <TextInput
              control={control}
              name="email"
              type="email"
              label="Correo"
              autoComplete="email"
              isRequired
            />
            <TextInput
              control={control}
              name="phone"
              type="tel"
              label="Teléfono"
              description="Opcional. Para avisarte de tus pedidos."
              autoComplete="tel"
            />
            <TextInput
              control={control}
              name="password"
              type="password"
              label="Contraseña"
              description="Mínimo 12 caracteres. Una frase es mejor que un jeroglífico."
              autoComplete="new-password"
              isRequired
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isPending={formState.isSubmitting || register.isPending}
            >
              Crear cuenta
            </Button>
          </Form>
        </Card.Content>

        <Card.Footer className="justify-center text-sm">
          <span className="opacity-70">¿Ya tienes cuenta?&nbsp;</span>
          <HeroLink>
            <Link to="/entrar">Entrar</Link>
          </HeroLink>
        </Card.Footer>
      </Card>
    </div>
  )
}
