import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { PencilLine, Star, X } from 'lucide-react'
import { reviewSubmissionSchema } from '../services/reviewSchema'
import { ReviewError, saveReview } from '../services/reviewService'

type Props = { kind: 'hotel' | 'driver'; subjectId: string; name: string; onPublished: () => void; initiallyOpen?: boolean }

export default function WritePartnerReview({ kind, subjectId, name, onPublished, initiallyOpen = false }: Props) {
  const [open, setOpen] = useState(initiallyOpen)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const button = trigger.current
    return () => button?.focus()
  }, [open])
  return <>
    <button ref={trigger} type="button" className="button button-outline partner-review-write" aria-haspopup="dialog" onClick={() => setOpen(true)}><PencilLine size={16} aria-hidden="true" />Write a review</button>
    {open && createPortal(<PartnerReviewDialog kind={kind} subjectId={subjectId} name={name} onPublished={onPublished} onClose={() => setOpen(false)} />, document.body)}
  </>
}

function PartnerReviewDialog({ kind, subjectId, name, onPublished, onClose }: Omit<Props, 'initiallyOpen'> & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const pending = useRef<{ fingerprint: string; id: string } | null>(null)
  const [rating, setRating] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    const overflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = overflow }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const fields = new FormData(event.currentTarget)
    const details = {
      reviewerName: String(fields.get('reviewerName') ?? ''), bookingId: String(fields.get('bookingId') ?? ''),
      experience: kind === 'hotel' ? 'Hotel stay' : 'Driver experience',
      driverId: kind === 'driver' ? subjectId : '', hotelId: kind === 'hotel' ? subjectId : '',
      rating: Number(fields.get('rating')), reviewText: String(fields.get('reviewText') ?? ''),
      publicationConsent: fields.has('publicationConsent'), website: String(fields.get('website') ?? ''),
    }
    const fingerprint = JSON.stringify(details)
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, id: crypto.randomUUID() }
    const parsed = reviewSubmissionSchema.safeParse({ ...details, id: pending.current.id })
    if (!parsed.success) { setError('Enter your display name, rating and review, and confirm publication consent.'); return }
    inFlight.current = true
    setSubmitting(true)
    setError('')
    try {
      const receipt = await saveReview(parsed.data)
      if (receipt.status !== 'published') throw new ReviewError('Your submission was saved but is not published. Please contact AVELOF for help.', 409)
      setSaved(true)
      onPublished()
    } catch (failure: unknown) {
      setError(failure instanceof ReviewError ? failure.message : 'Your review could not be confirmed. Please try again.')
    } finally { inFlight.current = false; setSubmitting(false) }
  }

  return <dialog ref={dialog} className="partner-review-dialog partner-review-form-dialog" aria-label={`Write a review for ${name}`} onCancel={(event) => { event.preventDefault(); if (!inFlight.current) onClose() }} onClose={(event) => { if (!event.currentTarget.open) onClose() }}>
    <header><h2>Write a review for {name}</h2><button className="icon-button" type="button" aria-label="Close review form" disabled={submitting} onClick={onClose}><X size={20} /></button></header>
    {saved ? <div className="review-ready" role="status"><h3>Thank you. Your review is published.</h3><p>Your review has been saved and published for {name}.</p><button className="button button-outline" type="button" onClick={() => { setSaved(false); setRating(''); pending.current = null }}>Write another review</button></div> : <form className="review-submission-form partner-review-form" onSubmit={submit} aria-busy={submitting}>
      <p className="privacy-note">Reviews are published immediately. Do not include phone numbers, addresses or payment information.</p>
      <fieldset disabled={submitting} className="partner-review-fields">
        <label>Display name<input name="reviewerName" autoComplete="nickname" maxLength={80} pattern=".*\S.*" required autoFocus /></label>
        <label>Booking ID (optional)<input name="bookingId" autoComplete="off" maxLength={80} /></label>
        <fieldset className="review-rating"><legend>Your rating</legend><div className="review-star-options">{Array.from({ length: 5 }, (_, index) => {
          const value = String(index + 1)
          return <label className={Number(rating) >= Number(value) ? 'is-selected' : ''} key={value}><input aria-label={`${value} star${value === '1' ? '' : 's'}`} type="radio" name="rating" value={value} checked={rating === value} onChange={(event) => setRating(event.target.value)} required /><Star aria-hidden="true" /></label>
        })}</div></fieldset>
        <label>Review<textarea name="reviewText" rows={4} maxLength={1600} required /></label>
        <label className="enquiry-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <label className="review-consent"><input type="checkbox" name="publicationConsent" required /><span>I confirm this is my own experience and consent to publication of my name, rating, review and booking ID if provided.</span></label>
      </fieldset>
      {error && <p className="enquiry-error" role="alert">{error}</p>}
      {submitting && <p role="status">Saving your review...</p>}
      <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? 'Saving review...' : 'Submit review'}</button>
    </form>}
  </dialog>
}
