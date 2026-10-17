import { Pagination } from '@heroui/react'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'

function pageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)

  const out: Array<number | 'gap'> = []
  let previous = 0
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push('gap')
    out.push(page)
    previous = page
  }
  return out
}

export function Pager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <Pagination className="flex flex-wrap items-center justify-between gap-4">
      <Pagination.Summary className="text-sm opacity-60">
        Página {page} de {totalPages} · {total} resultados
      </Pagination.Summary>

      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page <= 1} onPress={() => onChange(page - 1)}>
            <CaretLeftIcon size={16} />
            Anterior
          </Pagination.Previous>
        </Pagination.Item>

        {pageWindow(page, totalPages).map((entry, i) =>
          entry === 'gap' ? (
            <Pagination.Item key={`gap-${i}`}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={entry}>
              <Pagination.Link isActive={entry === page} onPress={() => onChange(entry)}>
                {entry}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}

        <Pagination.Item>
          <Pagination.Next isDisabled={page >= totalPages} onPress={() => onChange(page + 1)}>
            Siguiente
            <CaretRightIcon size={16} />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  )
}
