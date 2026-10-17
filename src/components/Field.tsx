import { Description, FieldError, Input, Label, TextArea, TextField } from '@heroui/react'
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import '../lib/zod-es'

interface BaseProps<T extends FieldValues, TTransformed = T> {
  control: Control<T, any, TTransformed>
  name: FieldPath<T>
  label: string
  description?: string
  placeholder?: string
  isRequired?: boolean
  autoComplete?: string
  autoFocus?: boolean
}

export function TextInput<T extends FieldValues, TT = T>({
  control,
  name,
  label,
  description,
  placeholder,
  isRequired,
  autoComplete,
  autoFocus,
  type = 'text',
}: BaseProps<T, TT> & { type?: 'text' | 'email' | 'password' | 'tel' | 'url' }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          name={field.name}
          type={type}
          value={field.value ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          isRequired={isRequired}
          isInvalid={Boolean(fieldState.error)}
          fullWidth
        >
          <Label>{label}</Label>
          <Input
            ref={field.ref}
            placeholder={placeholder}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
          />
          {description && <Description>{description}</Description>}
          <FieldError>{fieldState.error?.message}</FieldError>
        </TextField>
      )}
    />
  )
}

export function TextAreaInput<T extends FieldValues, TT = T>({
  control,
  name,
  label,
  description,
  placeholder,
  isRequired,
  rows = 4,
}: BaseProps<T, TT> & { rows?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          name={field.name}
          value={field.value ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          isRequired={isRequired}
          isInvalid={Boolean(fieldState.error)}
          fullWidth
        >
          <Label>{label}</Label>
          <TextArea ref={field.ref} rows={rows} placeholder={placeholder} />
          {description && <Description>{description}</Description>}
          <FieldError>{fieldState.error?.message}</FieldError>
        </TextField>
      )}
    />
  )
}

export function MoneyInput<T extends FieldValues, TT = T>({
  control,
  name,
  label,
  description,
  isRequired,
}: BaseProps<T, TT>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const cents = typeof field.value === 'number' ? field.value : 0
        return (
          <TextField
            name={field.name}
            value={cents ? String(cents / 100) : ''}
            onChange={(raw) => {
              const parsed = Number.parseFloat(raw.replace(/[^0-9.]/g, ''))
              field.onChange(Number.isFinite(parsed) ? Math.round(parsed * 100) : 0)
            }}
            onBlur={field.onBlur}
            isRequired={isRequired}
            isInvalid={Boolean(fieldState.error)}
            fullWidth
          >
            <Label>{label}</Label>
            <Input ref={field.ref} inputMode="decimal" placeholder="0.00" />
            {description && <Description>{description}</Description>}
            <FieldError>{fieldState.error?.message}</FieldError>
          </TextField>
        )
      }}
    />
  )
}

export function IntegerInput<T extends FieldValues, TT = T>({
  control,
  name,
  label,
  description,
  isRequired,
}: BaseProps<T, TT>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          name={field.name}
          value={field.value === undefined || field.value === null ? '' : String(field.value)}
          onChange={(raw) => {
            const digits = raw.replace(/[^0-9]/g, '')
            field.onChange(digits === '' ? 0 : Number.parseInt(digits, 10))
          }}
          onBlur={field.onBlur}
          isRequired={isRequired}
          isInvalid={Boolean(fieldState.error)}
          fullWidth
        >
          <Label>{label}</Label>
          <Input ref={field.ref} inputMode="numeric" />
          {description && <Description>{description}</Description>}
          <FieldError>{fieldState.error?.message}</FieldError>
        </TextField>
      )}
    />
  )
}
