import { Alert, Button, Card, Form, Link as HeroLink } from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LoginSchema, type LoginDto } from '@marketplace/contracts'
import { useLogin } from '../api/auth'
import { TextInput } from '../components/Field'
import { applyViolations, errorMessage, statusOf } from '../lib/problem'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const { control, handleSubmit, setError, formState } = useForm<LoginDto>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
      navigate(from, { replace: true })
    } catch (error) {
      applyViolations(error, setError)
    }
  })

  const credentialsRejected = statusOf(login.error) === 401

  return (
    <div className="mx-auto max-w-md">
      <Card className="rounded-(--radius-marketplace)">
        <Card.Header>
          <Card.Title className="text-2xl">Entrar</Card.Title>
          <Card.Description>Para comprar y para vender.</Card.Description>
        </Card.Header>

        <Card.Content>
          <Form onSubmit={onSubmit} className="space-y-4">
            {login.isError && (
              <Alert status="danger">
                <Alert.Content>
                  <Alert.Description>
                    {credentialsRejected
                      ? 'Correo o contraseña incorrectos.'
                      : errorMessage(login.error)}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <TextInput
              control={control}
              name="email"
              type="email"
              label="Correo"
              autoComplete="email"
              autoFocus
              isRequired
            />
            <TextInput
              control={control}
              name="password"
              type="password"
              label="Contraseña"
              autoComplete="current-password"
              isRequired
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isPending={formState.isSubmitting || login.isPending}
            >
              Entrar
            </Button>
          </Form>
        </Card.Content>

        <Card.Footer className="justify-center text-sm">
          <span className="opacity-70">¿Primera vez?&nbsp;</span>
          <HeroLink>
            <Link to="/crear-cuenta">Crear cuenta</Link>
          </HeroLink>
        </Card.Footer>
      </Card>
    </div>
  )
}
