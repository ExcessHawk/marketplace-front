import { Alert, Button, Card, Form } from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { UpdateSellerSchema, type UpdateSellerDto } from '@marketplace/contracts'
import { useMyStore, useUpdateStore } from '../../api/seller'
import { TextAreaInput, TextInput } from '../../components/Field'
import { FullPageSpinner } from '../../components/States'
import { applyViolations, errorMessage } from '../../lib/problem'

export function StoreSettingsPage() {
  const store = useMyStore()
  const update = useUpdateStore()

  const { control, handleSubmit, setError, formState, reset } = useForm<UpdateSellerDto>({
    resolver: zodResolver(UpdateSellerSchema),
    values: {
      storeName: store.data?.storeName ?? '',
      description: store.data?.description ?? '',
    },
  })

  if (store.isPending) return <FullPageSpinner />
  if (store.isError) return null

  const onSubmit = handleSubmit(async (values) => {
    try {
      const updated = await update.mutateAsync({
        storeName: values.storeName,
        description: values.description?.trim() || undefined,
      })
      reset({ storeName: updated.storeName, description: updated.description ?? '' })
      toast.success('Tienda actualizada')
    } catch (error) {
      if (!applyViolations(error, setError)) toast.error(errorMessage(error))
    }
  })

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl">Mi tienda</h1>

      <Card className="rounded-(--radius-marketplace)">
        <Card.Content className="pt-6">
          <Form onSubmit={onSubmit} className="space-y-4">
            <TextInput control={control} name="storeName" label="Nombre de la tienda" />
            <TextAreaInput control={control} name="description" label="Qué vendes" rows={5} />

            <Alert status="accent">
              <Alert.Content>
                <Alert.Description>
                  Tu dirección es <strong>/t/{store.data.slug}</strong> y no se puede cambiar: hay
                  enlaces apuntando a ella.
                </Alert.Description>
              </Alert.Content>
            </Alert>

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
    </div>
  )
}
