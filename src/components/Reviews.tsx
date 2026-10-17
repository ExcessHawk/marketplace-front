import { Button, Skeleton, TextArea, TextField } from '@heroui/react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { RatingSummary, ReviewView, ReviewableItem } from '@marketplace/contracts'
import {
  useCreateReview,
  useDeleteReview,
  useProductRatingSummary,
  useProductReviews,
  useReplyReview,
  useReviewable,
  useUpdateReview,
} from '../api/reviews'
import { RatingBadge, StarPicker, Stars } from './Rating'
import { Empty } from './States'
import { formatDate } from '../lib/format'
import { errorMessage } from '../lib/problem'

function Breakdown({ summary }: { summary: RatingSummary }) {
  if (summary.count === 0) return null

  return (
    <div className="space-y-1">
      {([5, 4, 3, 2, 1] as const).map((step) => {
        const count = summary.breakdown[String(step) as '1']
        const share = summary.count > 0 ? (count / summary.count) * 100 : 0
        return (
          <div key={step} className="flex items-center gap-2 text-xs">
            <span className="w-3 tabular-nums">{step}</span>
            <Stars value={step} size={10} />
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--color-default-100)">
              <span className="block h-full bg-current" style={{ width: `${share}%` }} />
            </span>
            <span className="w-6 text-right tabular-nums opacity-60">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function Review({ review, canReply }: { review: ReviewView; canReply: boolean }) {
  const reply = useReplyReview()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  return (
    <li className="space-y-2 border-b py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <Stars value={review.rating} />
        <span className="text-sm">{review.authorName}</span>
        <span className="text-xs opacity-60">{formatDate(review.createdAt)}</span>
        {review.isMine && <span className="text-xs opacity-60">· la tuya</span>}
      </div>

      {review.body && <p className="whitespace-pre-line text-sm opacity-85">{review.body}</p>}

      {review.sellerReply ? (
        <div className="rounded-(--radius-marketplace) bg-(--color-default-100) p-3 text-sm">
          <p className="text-xs opacity-60">Respuesta de la tienda</p>
          <p className="mt-1 whitespace-pre-line opacity-85">{review.sellerReply}</p>
        </div>
      ) : (
        canReply && (
          <div className="space-y-2">
            {open ? (
              <>
                <TextField aria-label="Respuesta" value={text} onChange={setText} fullWidth>
                  <TextArea rows={2} placeholder="Responde a quien te compró" />
                </TextField>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    isDisabled={text.trim().length < 2}
                    isPending={reply.isPending}
                    onPress={() =>
                      reply.mutate(
                        { id: review.id, reply: text.trim() },
                        {
                          onSuccess: () => {
                            toast.success('Respuesta publicada')
                            setOpen(false)
                            setText('')
                          },
                          onError: (error) => toast.error(errorMessage(error)),
                        },
                      )
                    }
                  >
                    Publicar respuesta
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => setOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <Button size="sm" variant="ghost" onPress={() => setOpen(true)}>
                Responder
              </Button>
            )}
          </div>
        )
      )}
    </li>
  )
}

export function ProductReviews({ slug, canReply = false }: { slug: string; canReply?: boolean }) {
  const summary = useProductRatingSummary(slug)
  const list = useProductReviews(slug, 1)

  if (summary.isPending || list.isPending) {
    return <Skeleton className="h-40 rounded-(--radius-marketplace)" />
  }

  if (!summary.data || summary.data.count === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl">Opiniones</h2>
        <Empty
          title="Todavía nadie opina de esto"
          message="Las opiniones las escribe quien ya lo compró y lo recibió."
        />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl">Opiniones</h2>

      <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-1">
          <p className="text-4xl tabular-nums">{summary.data.average?.toFixed(1)}</p>
          <Stars value={summary.data.average ?? 0} size={16} />
          <p className="text-xs opacity-60">
            {summary.data.count} {summary.data.count === 1 ? 'opinión' : 'opiniones'}
          </p>
        </div>
        <Breakdown summary={summary.data} />
      </div>

      <ul>
        {list.data?.items.map((review) => (
          <Review key={review.id} review={review} canReply={canReply} />
        ))}
      </ul>
    </section>
  )
}

function ReviewForm({ suborderId, item }: { suborderId: string; item: ReviewableItem }) {
  const create = useCreateReview()
  const update = useUpdateReview()
  const remove = useDeleteReview()

  const [rating, setRating] = useState(item.review?.rating ?? 0)
  const [body, setBody] = useState(item.review?.body ?? '')
  const [editing, setEditing] = useState(!item.review)

  if (item.review && !editing) {
    return (
      <li className="flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
        <span className="min-w-0 flex-1 truncate text-sm">{item.productTitle}</span>
        <Stars value={item.review.rating} />
        <Button size="sm" variant="ghost" onPress={() => setEditing(true)}>
          Cambiar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isPending={remove.isPending}
          onPress={() =>
            remove.mutate(item.review!.id, {
              onSuccess: () => {
                toast.success('Opinión eliminada')
                setRating(0)
                setBody('')
                setEditing(true)
              },
              onError: (error) => toast.error(errorMessage(error)),
            })
          }
        >
          Quitar
        </Button>
      </li>
    )
  }

  const pending = create.isPending || update.isPending

  return (
    <li className="space-y-2 border-b py-3 last:border-0">
      <p className="text-sm">{item.productTitle}</p>
      <StarPicker value={rating} onChange={setRating} disabled={pending} />

      <TextField aria-label="Tu opinión" value={body} onChange={setBody} fullWidth>
        <TextArea rows={2} placeholder="Qué tal te fue. Opcional." />
      </TextField>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          isDisabled={rating === 0}
          isPending={pending}
          onPress={() => {
            const payload = { rating, body: body.trim() || undefined }
            const done = {
              onSuccess: () => {
                toast.success('Gracias por opinar')
                setEditing(false)
              },
              onError: (error: unknown) => toast.error(errorMessage(error)),
            }
            if (item.review) update.mutate({ id: item.review.id, ...payload }, done)
            else create.mutate({ suborderId, productId: item.productId, ...payload }, done)
          }}
        >
          {item.review ? 'Guardar cambios' : 'Publicar opinión'}
        </Button>
        {rating === 0 && <span className="text-xs opacity-60">Elige cuántas estrellas.</span>}
        {item.review && (
          <Button size="sm" variant="ghost" onPress={() => setEditing(false)}>
            Cancelar
          </Button>
        )}
      </div>
    </li>
  )
}

export function SuborderReviews({ suborderId }: { suborderId: string }) {
  const reviewable = useReviewable(suborderId)

  if (reviewable.isPending || !reviewable.data?.canReview) return null
  if (reviewable.data.items.length === 0) return null

  return (
    <div className="space-y-2 pt-3">
      <p className="text-sm opacity-70">¿Qué tal te fue?</p>
      <ul>
        {reviewable.data.items.map((item) => (
          <ReviewForm key={item.productId} suborderId={suborderId} item={item} />
        ))}
      </ul>
    </div>
  )
}

export { RatingBadge }
