import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import ReviewCard from './ReviewCard'
import ReviewStars from './ReviewStars'
import WritePartnerReview from './WritePartnerReview'
import { loadPublicReviews, ReviewError } from '../services/reviewService'
import type { PublicReview } from '../services/reviewSchema'

type PartnerReviewProps = { kind: 'hotel' | 'driver'; subjectId: string; name: string; reviewsPath: string }

export default function PartnerReviewPreview(props: PartnerReviewProps) {
  return <PartnerReviewContent key={`${props.kind}:${props.subjectId}`} {...props} />
}

function PartnerReviewContent({ kind, subjectId, name, reviewsPath }: PartnerReviewProps) {
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [selected, setSelected] = useState<PublicReview | null>(null)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(motion.matches)
    motion.addEventListener('change', update)
    return () => motion.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadPublicReviews(1, controller.signal, kind === 'hotel' ? { hotelId: subjectId } : { driverId: subjectId })
      .then((listing) => { if (!controller.signal.aborted) setReviews(listing.reviews) })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof ReviewError ? cause.message : 'Reviews could not be loaded. Please try again.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [kind, subjectId, version])

  useEffect(() => {
    if (paused || hovered || reducedMotion || selected || reviews.length < 2) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % reviews.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [paused, hovered, reducedMotion, selected, reviews.length])

  useEffect(() => {
    if (!selected) return
    const element = dialog.current
    const button = trigger.current
    const overflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = overflow
      button?.focus()
    }
  }, [selected])

  const review = reviews[index]
  function move(direction: number) {
    setPaused(true)
    setIndex((current) => (current + direction + reviews.length) % reviews.length)
  }

  return <section className="partner-review-preview" aria-label={`Reviews for ${name}`}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setPaused(true)}>
    <div className="partner-review-content">
      {loading ? <p role="status">Loading reviews...</p> : error ? <p role="alert">{error} <button type="button" className="text-link" onClick={() => { setLoading(true); setError(''); setVersion((current) => current + 1) }}>Retry reviews</button></p> : review ? <>
        <button ref={trigger} type="button" className="partner-review-tile" aria-haspopup="dialog" aria-label={`Read full review by ${review.reviewerName || 'Anonymous guest'}`} onClick={() => { setPaused(true); setSelected(review) }}>
          <span className="partner-review-heading"><strong>{review.reviewerName || 'Anonymous guest'}</strong><ReviewStars rating={review.rating} /></span>
          {review.title && <strong className="partner-review-title">{review.title}</strong>}
          <span className="partner-review-excerpt">{review.reviewText || 'Star rating only.'}</span>
          <span className="partner-review-read">Read full review</span>
        </button>
        <div className="partner-review-controls">
          {reviews.length > 1 && <><button type="button" className="icon-button" aria-label="Previous review" onClick={() => move(-1)}><ChevronLeft size={16} /></button><span>{index + 1} / {reviews.length}</span><button type="button" className="icon-button" aria-label="Next review" onClick={() => move(1)}><ChevronRight size={16} /></button>{!reducedMotion && <button type="button" className="icon-button" aria-label={paused ? 'Resume review rotation' : 'Pause review rotation'} onClick={() => setPaused((current) => !current)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>}</>}
        </div>
      </> : <p className="partner-review-empty" role="status">No reviews yet. Be the first to share your experience.</p>}
    </div>
    <div className="partner-review-actions">
      <Link className="button button-outline partner-review-write" to={reviewsPath}>View reviews</Link>
      <WritePartnerReview kind={kind} subjectId={subjectId} name={name} onPublished={() => { setIndex(0); setError(''); setVersion((current) => current + 1) }} />
    </div>
    {selected && createPortal(<dialog ref={dialog} className="partner-review-dialog" aria-label={`Review for ${name}`} onCancel={() => setSelected(null)} onClose={() => setSelected(null)} onClick={(event) => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setSelected(null)
    }}>
      <header><h2>Review for {name}</h2><button type="button" className="icon-button" aria-label="Close review" autoFocus onClick={() => setSelected(null)}><X size={20} /></button></header>
      <ReviewCard review={selected} />
    </dialog>, document.body)}
  </section>
}
