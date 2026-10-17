import { Button, Card, Form, Label, ListBox, Select } from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeftIcon, ImageIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CreateProductSchema,
  ReplaceVariantsSchema,
  UpdateProductSchema,
  type CreateProductDto,
  type CreateProductInput,
  type ReplaceVariantsDto,
  type ReplaceVariantsInput,
  type SellerProductDetail,
  type UpdateProductDto,
} from '@marketplace/contracts'
import { UPLOAD_ACCEPT } from '@marketplace/contracts'
import { useCategories } from '../../api/catalog'
import { revisarImagen, useUploadImage } from '../../api/uploads'
import {
  useCreateProduct,
  useReplaceVariants,
  useSellerProduct,
  useUpdateProduct,
} from '../../api/seller'
import { IntegerInput, MoneyInput, TextAreaInput, TextInput } from '../../components/Field'
import { ErrorState, FullPageSpinner } from '../../components/States'
import { applyViolations, errorMessage, statusOf } from '../../lib/problem'
import { slugify } from '../../lib/slug'

const EMPTY_VARIANT = { name: '', priceCents: 0, stock: 0, imageKeys: [] as string[] }

function CategorySelect<T extends FieldValues, TT = T>({
  control,
}: {
  control: Control<T, any, TT>
}) {
  const categories = useCategories()

  return (
    <Controller
      control={control}
      name={'categoryId' as FieldPath<T>}
      render={({ field }) => (
        <div className="space-y-1">
          <Label>Categoría</Label>
          <Select
            aria-label="Categoría"
            placeholder={categories.data?.length ? 'Sin categoría' : 'No hay categorías todavía'}
            selectedKey={(field.value as string | undefined) ?? null}
            onSelectionChange={(key) => field.onChange(key ? String(key) : undefined)}
            isDisabled={!categories.data?.length}
            fullWidth
          >
            <Select.Trigger className="rounded-(--radius-marketplace)">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {(categories.data ?? []).map((node) => (
                  <ListBox.Item key={node.id} id={node.id} textValue={node.name}>
                    {node.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      )}
    />
  )
}

/**
 * Fotos de una variante.
 *
 * La primera es la que sale en el catálogo, y eso se dice en pantalla: sin
 * decirlo, el orden parece decorativo y nadie entiende por qué la portada
 * muestra una y no otra.
 */
function ImageField({
  control,
  index,
}: {
  control: Control<ReplaceVariantsInput, any, any>
  index: number
}) {
  const subir = useUploadImage()
  const input = useRef<HTMLInputElement>(null)

  return (
    <Controller
      control={control}
      name={`variants.${index}.imageKeys` as FieldPath<ReplaceVariantsInput>}
      render={({ field }) => {
        const claves = (field.value as string[] | undefined) ?? []

        const elegir = async (archivos: FileList | null) => {
          if (!archivos?.length) return
          const nuevas: string[] = []
          for (const archivo of Array.from(archivos)) {
            const problema = revisarImagen(archivo)
            if (problema) {
              toast.error(`${archivo.name}: ${problema}`)
              continue
            }
            try {
              const subida = await subir.mutateAsync(archivo)
              nuevas.push(subida.url)
            } catch (error) {
              toast.error(`${archivo.name}: ${errorMessage(error)}`)
            }
          }
          if (nuevas.length) field.onChange([...claves, ...nuevas])
          if (input.current) input.current.value = ''
        }

        return (
          <div className="space-y-2">
            <Label>Fotos</Label>
            <div className="flex flex-wrap items-center gap-2">
              {claves.map((clave, i) => (
                <div
                  key={clave}
                  className="group relative size-20 overflow-hidden rounded-(--radius-marketplace) border border-(--color-default-200)"
                >
                  <img src={clave} alt="" className="size-full object-cover" />
                  {i === 0 && (
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 text-center text-[10px] text-white">
                      portada
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Quitar foto"
                    onClick={() => field.onChange(claves.filter((c) => c !== clave))}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  >
                    <XIcon size={12} weight="bold" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={subir.isPending}
                className="flex size-20 flex-col items-center justify-center gap-1 rounded-(--radius-marketplace) border border-dashed border-(--color-default-300) text-xs opacity-70 transition hover:opacity-100 disabled:opacity-40"
              >
                <ImageIcon size={18} weight="duotone" />
                {subir.isPending ? 'Subiendo…' : 'Agregar'}
              </button>

              <input
                ref={input}
                type="file"
                accept={UPLOAD_ACCEPT}
                multiple
                hidden
                onChange={(e) => void elegir(e.target.files)}
              />
            </div>
            <p className="text-xs opacity-60">
              JPEG, PNG o WebP, hasta 2 MB. La primera es la que se ve en el catálogo.
            </p>
          </div>
        )
      }}
    />
  )
}

function VariantFields({
  control,
}: {
  control: Control<ReplaceVariantsInput, any, any>
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'variants' })
  const values = useWatch({ control, name: 'variants' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg">Variantes</h2>
          <p className="text-sm opacity-60">
            Cada talla, color o presentación con su propio precio y existencias.
          </p>
        </div>
        <Button size="sm" variant="outline" onPress={() => append({ ...EMPTY_VARIANT })}>
          <PlusIcon size={16} weight="bold" />
          Agregar
        </Button>
      </div>

      {fields.map((field, index) => (
        <Card key={field.id} className="rounded-(--radius-marketplace)">
          <Card.Content className="space-y-4 pt-6">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <TextInput
                  control={control}
                  name={`variants.${index}.name`}
                  label="Nombre"
                  placeholder="Chica, Roja, 500 g…"
                  isRequired
                />
              </div>
              {fields.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Quitar variante"
                  className="mt-7"
                  onPress={() => remove(index)}
                >
                  <TrashIcon size={16} />
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyInput
                control={control}
                name={`variants.${index}.priceCents`}
                label="Precio (MXN)"
                isRequired
              />
              <MoneyInput
                control={control}
                name={`variants.${index}.compareAtCents`}
                label="Precio anterior"
                description="Opcional. Se muestra tachado."
              />
              <IntegerInput
                control={control}
                name={`variants.${index}.stock`}
                label="Existencias"
              />
              <TextInput
                control={control}
                name={`variants.${index}.sku`}
                label="SKU"
                description="Opcional. Único dentro del producto."
              />
            </div>

            <ImageField control={control} index={index} />

            {values?.[index]?.priceCents === 0 && (
              <p className="text-xs opacity-60">Precio en $0.00 — ¿seguro?</p>
            )}
          </Card.Content>
        </Card>
      ))}
    </div>
  )
}

function CreateProductForm() {
  const navigate = useNavigate()
  const create = useCreateProduct()

  const { control, handleSubmit, setError, setValue, watch, formState } = useForm<
    CreateProductInput,
    unknown,
    CreateProductDto
  >({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      variants: [{ ...EMPTY_VARIANT, name: 'Única' }],
    },
  })

  const title = watch('title')

  useEffect(() => {
    if (formState.dirtyFields.slug) return
    setValue('slug', slugify(title ?? ''))
  }, [title, formState.dirtyFields.slug, setValue])

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await create.mutateAsync({
        ...values,
        description: values.description?.trim() || undefined,
        variants: values.variants.map((variant) => ({
          ...variant,
          sku: variant.sku?.trim() || undefined,
          compareAtCents: variant.compareAtCents || undefined,
        })),
      })
      toast.success('Producto creado como borrador')
      navigate(`/panel/productos/${created.id}`, { replace: true })
    } catch (error) {
      if (!applyViolations(error, setError)) toast.error(errorMessage(error))
    }
  })

  return (
    <Form onSubmit={onSubmit} className="space-y-6">
      <Card className="rounded-(--radius-marketplace)">
        <Card.Content className="space-y-4 pt-6">
          <TextInput control={control} name="title" label="Título" autoFocus isRequired />
          <TextInput
            control={control}
            name="slug"
            label="Dirección"
            description={`/p/${watch('slug') || 'tu-producto'}`}
            isRequired
          />
          <TextAreaInput control={control} name="description" label="Descripción" rows={6} />
          <CategorySelect control={control} />
        </Card.Content>
      </Card>

      <VariantFields control={control as unknown as Control<ReplaceVariantsInput>} />

      <div className="flex gap-2">
        <Button type="submit" variant="primary" isPending={formState.isSubmitting}>
          Crear producto
        </Button>
        <Button variant="ghost" onPress={() => navigate('/panel')}>
          Cancelar
        </Button>
      </div>

      <p className="text-sm opacity-60">
        Se guarda como borrador. Publicarlo es un paso aparte, desde la lista.
      </p>
    </Form>
  )
}

function EditProductForms({ product }: { product: SellerProductDetail }) {
  const navigate = useNavigate()
  const updateProduct = useUpdateProduct(product.id)
  const replaceVariants = useReplaceVariants(product.id)

  const details = useForm<UpdateProductDto>({
    resolver: zodResolver(UpdateProductSchema),
    values: {
      title: product.title,
      slug: product.slug,
      description: product.description ?? '',
      categoryId: product.categoryId ?? undefined,
    },
  })

  const variantsForm = useForm<ReplaceVariantsInput, unknown, ReplaceVariantsDto>({
    resolver: zodResolver(ReplaceVariantsSchema),
    values: {
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku ?? undefined,
        priceCents: variant.priceCents,
        compareAtCents: variant.compareAtCents ?? undefined,
        stock: variant.stock,
        imageKeys: variant.imageKeys,
      })),
    },
  })

  const onSaveDetails = details.handleSubmit(async (values) => {
    try {
      await updateProduct.mutateAsync({
        ...values,
        description: values.description?.trim() || undefined,
      })
      toast.success('Producto actualizado')
    } catch (error) {
      if (!applyViolations(error, details.setError)) toast.error(errorMessage(error))
    }
  })

  const onSaveVariants = variantsForm.handleSubmit(async (values) => {
    try {
      await replaceVariants.mutateAsync({
        variants: values.variants.map((variant) => ({
          ...variant,
          sku: variant.sku?.trim() || undefined,
          compareAtCents: variant.compareAtCents || undefined,
        })),
      })
      toast.success('Variantes guardadas')
    } catch (error) {
      if (!applyViolations(error, variantsForm.setError)) toast.error(errorMessage(error))
    }
  })

  return (
    <div className="space-y-8">
      <Form onSubmit={onSaveDetails} className="space-y-6">
        <Card className="rounded-(--radius-marketplace)">
          <Card.Content className="space-y-4 pt-6">
            <TextInput control={details.control} name="title" label="Título" />
            <TextInput
              control={details.control}
              name="slug"
              label="Dirección"
              description={`/p/${details.watch('slug') || product.slug}`}
            />
            <TextAreaInput
              control={details.control}
              name="description"
              label="Descripción"
              rows={6}
            />
            <CategorySelect control={details.control} />
          </Card.Content>
        </Card>

        <Button
          type="submit"
          variant="primary"
          isDisabled={!details.formState.isDirty}
          isPending={details.formState.isSubmitting}
        >
          Guardar datos
        </Button>
      </Form>

      <Form onSubmit={onSaveVariants} className="space-y-6">
        <VariantFields control={variantsForm.control} />
        <Button
          type="submit"
          variant="primary"
          isDisabled={!variantsForm.formState.isDirty}
          isPending={variantsForm.formState.isSubmitting}
        >
          Guardar variantes
        </Button>
      </Form>

      <Button variant="ghost" onPress={() => navigate('/panel')}>
        <ArrowLeftIcon size={16} />
        Volver a productos
      </Button>
    </div>
  )
}

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const product = useSellerProduct(id)

  if (!id) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl">Nuevo producto</h1>
        <CreateProductForm />
      </div>
    )
  }

  if (product.isPending) return <FullPageSpinner />

  if (product.isError) {
    return (
      <ErrorState
        title={statusOf(product.error) === 404 ? 'Ese producto no está' : 'No se pudo cargar'}
        message={errorMessage(product.error)}
        onRetry={() => product.refetch()}
      />
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl">{product.data.title}</h1>
      <EditProductForms product={product.data} />
    </div>
  )
}
