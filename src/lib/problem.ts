import { AxiosError } from 'axios'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

export interface Violation {
  field: string
  message: string
  code?: string
}

export interface Problem {
  type?: string
  title?: string
  status?: number
  detail?: string
  error?: string
  violations?: Violation[]
  details?: unknown
}

export function problemOf(error: unknown): Problem | null {
  if (error instanceof AxiosError) return (error.response?.data as Problem) ?? null
  return null
}

export function statusOf(error: unknown): number | undefined {
  return error instanceof AxiosError ? error.response?.status : undefined
}

export function errorMessage(error: unknown, fallback = 'Algo salió mal. Intenta de nuevo.'): string {
  const problem = problemOf(error)
  return problem?.detail ?? problem?.error ?? fallback
}

export function applyViolations<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  const violations = problemOf(error)?.violations
  if (!violations?.length) return false

  for (const violation of violations) {
    setError(violation.field as Path<T>, { type: 'server', message: violation.message })
  }
  return true
}
