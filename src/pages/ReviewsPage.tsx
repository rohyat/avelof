import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, RefreshCw, Star, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import ReviewCarousel from '../components/ReviewCarousel'
import OwnerPushNotifications from '../components/OwnerPushNotifications'
import { deleteReview as deleteReviewRequest, loadAdminReviews, loadPublicReviews, moderateReview, ReviewError, saveReview } from '../services/reviewService'
import { reviewSubmissionSchema } from '../services/reviewSchema'
import type { AdminReview, PublicReview, ReviewStatus } from '../services/reviewSchema'

const experienceOptions = ['General experience', 'Deluxe', 'Premium', 'Luxury', 'Custom package', 'Hotel stay', 'Cab rental']
const moderationLabels = { pending: 'Awaiting approval', published: 'Published', rejected: 'Hidden' }

function reviewError(error: unknown) {
  return error instanceof ReviewError ? error.message : 'We could not confirm the review request. Please try again.'
}

function Stars({ rating }: { rating: number }) {
  return <div className="review-stars" aria-label={`${rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star className={index < rating ? '' : 'review-empty-star'} key={index} aria-hidden="true" />)}</div>
}

function reviewMonthLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
}

function ReviewCard({ review }: { review: PublicReview }) {
  return <article id={`guest-review-${review.id}`} className="review-card">
    <div className="review-card-head"><div className="review-card-identity"><strong>{review.reviewerName}</strong>{review.bookingId && <span className="review-booking-id">Booking ID: {review.bookingId}</span>}</div><span className="review-source-label">Guest review</span></div>
    <Stars rating={review.rating} />
    {review.title && <h3 className="review-card-title">{review.title}</h3>}
    <blockquote>{review.reviewText}</blockquote>
    <div className="review-card-footer"><span>{review.experience}</span><small><time dateTime={review.reviewMonth || review.publishedAt}>{review.reviewMonth ? `Reviewed ${reviewMonthLabel(review.reviewMonth)}` : `Published ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(review.publishedAt))}`}</time></small></div>
  </article>
}

export default function ReviewsPage() {
  const [rating, setRating] = useState('')
  const [saved, setSaved] = useState<ReviewStatus | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [listing, setListing] = useState<Awaited<ReturnType<typeof loadPublicReviews>> | null>(null)
  const [page, setPage] = useState(1)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const inFlight = useRef(false)
  const pending = useRef<{ fingerprint: string; id: string } | null>(null)
  const newlyPublishedReviewId = useRef<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadPublicReviews(page, controller.signal).then((nextListing) => {
      setListing(nextListing)
      const newReviewId = newlyPublishedReviewId.current
      if (newReviewId && nextListing.reviews.some((review) => review.id === newReviewId)) {
        newlyPublishedReviewId.current = null
        requestAnimationFrame(() => document.getElementById(`guest-review-${newReviewId}`)?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center',
        }))
      }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setListing(null); setLoadError(reviewError(error)) }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, refreshVersion])

  function refresh(nextPage = page) {
    setLoading(true)
    setLoadError('')
    setPage(nextPage)
    setRefreshVersion((current) => current + 1)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const fields = new FormData(event.currentTarget)
    const details = {
      reviewerName: String(fields.get('reviewerName') ?? ''), bookingId: String(fields.get('bookingId') ?? ''),
      experience: String(fields.get('experience') ?? 'General experience'), rating: Number(fields.get('rating')),
      title: String(fields.get('title') ?? ''), reviewText: String(fields.get('reviewText') ?? ''),
      publicationConsent: fields.has('publicationConsent'), website: String(fields.get('website') ?? ''),
    }
    const fingerprint = JSON.stringify(details)
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, id: crypto.randomUUID() }
    const parsed = reviewSubmissionSchema.safeParse({ ...details, id: pending.current.id })
    if (!parsed.success) { setSubmitError('Please check your review details, rating and publication consent.'); return }
    inFlight.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      const receipt = await saveReview(parsed.data)
      setSaved(receipt.status)
      if (receipt.status === 'published') {
        newlyPublishedReviewId.current = receipt.id
        refresh(1)
      }
    }
    catch (error) { setSubmitError(reviewError(error)) }
    finally { inFlight.current = false; setSubmitting(false) }
  }

  return <>
    <section className="page-hero"><div className="page-width"><div className="breadcrumb"><Link to="/">Home</Link><span>/</span><span>Reviews</span></div><p className="eyebrow">Stories from the valley</p><h1>Travel leaves<br /><em>a little something.</em></h1><p>Every honest experience matters. Positive, mixed, and critical feedback is welcome.</p></div></section>
    <section className="reviews-page page-width">
      <div className="review-invite review-invite-top"><div><p className="eyebrow">Share your experience</p><h2>We’d love to hear your story.</h2></div><a className="button button-dark" href="#share-review">Write a review <ArrowRight size={16} /></a></div>
      <div className="review-feed-heading"><div><h2>Guest reviews</h2>{listing && listing.total > 0 && <p>{listing.averageRating?.toFixed(1)} out of 5 · {listing.total} published {listing.total === 1 ? 'review' : 'reviews'}</p>}</div><button className="icon-button" onClick={() => refresh()} disabled={loading} title="Refresh reviews" aria-label="Refresh reviews"><RefreshCw size={18} /></button></div>
      <p className="privacy-note">Feedback shared with AVELOF. All perspectives are welcome.</p>
      {loading && <p role="status">Loading reviews...</p>}
      {loadError && <p className="enquiry-error" role="alert">{loadError}</p>}
      <ReviewCarousel>{listing?.reviews.map((review) => <ReviewCard key={review.id} review={review} />)}</ReviewCarousel>
      {!loading && !loadError && listing?.total === 0 && <p className="review-empty" role="status">No published reviews yet.</p>}
      {listing && listing.total > 25 && <div className="admin-enquiry-pagination"><span>Page {page} of {Math.ceil(listing.total / 25)}</span><button className="icon-button" title="Previous reviews" aria-label="Previous reviews" disabled={loading || page <= 1} onClick={() => refresh(page - 1)}><ChevronLeft size={20} /></button><button className="icon-button" title="Next reviews" aria-label="Next reviews" disabled={loading || page * 25 >= listing.total} onClick={() => refresh(page + 1)}><ChevronRight size={20} /></button></div>}
      <section className="review-submission" id="share-review" aria-labelledby="review-form-title">
        <div><p className="eyebrow">All perspectives welcome</p><h2 id="review-form-title">Tell us about your experience.</h2><p>No booking ID or prior booking confirmation is required. Reviews appear after submission. Do not include phone numbers, addresses or payment information.</p></div>
        {saved ? <div className="review-ready" role="status"><h3>Thank you. Your review has been saved.</h3><p>{saved === 'published' ? 'Your review is published and now appears in Guest reviews.' : saved === 'pending' ? 'Your review is not currently public. Please contact AVELOF for help.' : 'Your submission is not currently published.'}</p><button className="text-link" type="button" onClick={() => { setSaved(null); setRating(''); pending.current = null }}>Write another review <ArrowRight size={16} /></button></div> : <form className="review-submission-form" onSubmit={submit} aria-busy={submitting}>
          <label>Display name<input name="reviewerName" autoComplete="nickname" maxLength={80} required placeholder="Name to publish" /></label>
          <label>Booking ID (optional, shown publicly)<input name="bookingId" autoComplete="off" maxLength={80} placeholder="Optional booking reference" /></label>
          <label>Experience<select name="experience" defaultValue="General experience">{experienceOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label>Review title (optional)<input name="title" maxLength={120} /></label>
          <fieldset className="review-rating"><legend>Your rating</legend><div className="review-star-options">{Array.from({ length: 5 }, (_, index) => { const value = String(index + 1); return <label className={Number(rating) >= Number(value) ? 'is-selected' : ''} key={value}><input aria-label={`${value} star${value === '1' ? '' : 's'}`} type="radio" name="rating" value={value} checked={rating === value} onChange={(event) => setRating(event.target.value)} required /><Star aria-hidden="true" /></label> })}</div></fieldset>
          <label className="review-text-field">Your review<textarea name="reviewText" rows={5} minLength={20} maxLength={1600} required placeholder="Share your honest experience." /></label>
          <label className="enquiry-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
          <label className="review-consent"><input type="checkbox" name="publicationConsent" required /><span>I confirm this is my own experience and consent to immediate publication of my display name, rating, review and booking ID, if provided.</span></label>
          {submitError && <p className="enquiry-error review-text-field" role="alert">{submitError}</p>}
          <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? 'Saving review...' : 'Submit review'} <ArrowRight size={16} /></button>
        </form>}
      </section>
    </section>
  </>
}

export function AdminReviewsPage() {
  const [listing, setListing] = useState<Awaited<ReturnType<typeof loadAdminReviews>> | null>(null)
  const [filters, setFilters] = useState<{ page: number; status: ReviewStatus | 'all'; refresh: number }>({ page: 1, status: 'all', refresh: 0 })
  const [loading, setLoading] = useState(true)
  const [signedOut, setSignedOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadAdminReviews(filters.page, filters.status, controller.signal).then((data) => { setListing(data); setSignedOut(false) }).catch((failure: unknown) => {
      if (controller.signal.aborted) return
      setListing(null)
      if (failure instanceof ReviewError && failure.status === 401) setSignedOut(true)
      else setError(reviewError(failure))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filters])

  function refresh(page = filters.page, status = filters.status) {
    setLoading(true)
    setError('')
    setFilters({ page, status, refresh: filters.refresh + 1 })
  }

  async function moderate(review: AdminReview, status: ReviewStatus) {
    if (savingId) return
    setSavingId(review.id)
    setError('')
    try { await moderateReview(review.id, status, review.version); setNotice(`Review ${moderationLabels[status].toLowerCase()}.`); refresh() }
    catch (failure) { if (failure instanceof ReviewError && failure.status === 401) { setSignedOut(true); setListing(null) } else setError(reviewError(failure)) }
    finally { setSavingId(null) }
  }

  async function removeReview(review: AdminReview) {
    if (savingId || !window.confirm(`Permanently delete this review by ${review.reviewerName}? This cannot be undone.`)) return
    setSavingId(review.id)
    setError('')
    try {
      await deleteReviewRequest(review.id, review.version)
      setNotice('Review permanently deleted.')
      refresh(listing?.reviews.length === 1 && filters.page > 1 ? filters.page - 1 : filters.page)
    } catch (failure) {
      if (failure instanceof ReviewError && failure.status === 401) { setSignedOut(true); setListing(null) }
      else setError(reviewError(failure))
    } finally { setSavingId(null) }
  }

  return <section className="enquiry-access-page admin-reviews-page page-width">
    <Link className="text-link" to="/admin/panel"><ArrowLeft size={16} /> Owner dashboard</Link>
    <div className="enquiry-access-heading"><Star size={28} /><div><p className="eyebrow">AVELOF owner access</p><h1>Review moderation</h1></div></div>
    {signedOut ? <p>Please <Link className="text-link" to="/admin/panel">sign in to the owner dashboard</Link> before managing reviews.</p> : <>
      <nav className="admin-section-nav" aria-label="Owner sections"><Link to="/admin/panel">Enquiries</Link><span aria-current="page">Reviews</span></nav>
      <OwnerPushNotifications />
      <div className="admin-enquiry-toolbar"><strong>{listing?.total ?? 0} {listing?.total === 1 ? 'review' : 'reviews'}</strong><label className="full-field admin-status-filter"><span className="sr-only">Review status</span><select value={filters.status} onChange={(event) => refresh(1, event.target.value as ReviewStatus | 'all')} disabled={loading || Boolean(savingId)}><option value="pending">Awaiting approval</option><option value="published">Published</option><option value="rejected">Hidden</option><option value="all">All reviews</option></select></label><button className="icon-button" title="Refresh reviews" aria-label="Refresh reviews" disabled={loading || Boolean(savingId)} onClick={() => refresh()}><RefreshCw size={18} /></button></div>
      {notice && <p className="booking-admin-notice" role="status">{notice}</p>}
      {loading && <p role="status">Loading reviews...</p>}
      {error && <p className="enquiry-error" role="alert">{error}</p>}
      <div className="admin-review-list">{listing?.reviews.map((review) => <article className="admin-review-record" key={review.id}>
        <div className="admin-review-heading"><strong>{review.reviewerName}</strong><span className="enquiry-status">{moderationLabels[review.status]}</span></div>
        <Stars rating={review.rating} />
        <p className="privacy-note">{review.experience} · {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(review.createdAt))}</p>
        {review.reviewMonth && <p className="privacy-note">Original review month: {reviewMonthLabel(review.reviewMonth)}</p>}
        {review.title && <h2>{review.title}</h2>}<p className="admin-review-text">{review.reviewText}</p>
        <p className="privacy-note">Booking ID (shown with published reviews): {review.bookingId || 'Not provided'}. Source: {review.submissionSource === 'owner_provided' ? 'Owner-provided guest review' : 'Website guest submission'}. Not independently verified.</p>
        <div className="admin-review-actions">{review.status !== 'published' && <button className="button button-dark" disabled={Boolean(savingId) || loading} onClick={() => moderate(review, 'published')}><Check size={16} /> {savingId === review.id ? 'Saving...' : 'Publish review'}</button>}{review.status !== 'rejected' && <button className="button confirmation-close" disabled={Boolean(savingId) || loading} onClick={() => moderate(review, 'rejected')}>Hide review</button>}{review.status !== 'pending' && <button className="text-link" disabled={Boolean(savingId) || loading} onClick={() => moderate(review, 'pending')}>Return to pending</button>}<button className="button admin-record-delete" disabled={Boolean(savingId) || loading} onClick={() => removeReview(review)}><Trash2 size={16} /> {savingId === review.id ? 'Deleting...' : 'Delete review'}</button></div>
      </article>)}</div>
      {!loading && !error && !listing?.reviews.length && <p className="review-empty">No reviews in this view.</p>}
      {listing && <div className="admin-enquiry-pagination"><span>Page {filters.page} · {listing.total} {listing.total === 1 ? 'review' : 'reviews'}</span><button className="icon-button" title="Previous reviews" aria-label="Previous reviews" disabled={loading || Boolean(savingId) || filters.page <= 1} onClick={() => refresh(filters.page - 1)}><ChevronLeft size={20} /></button><button className="icon-button" title="Next reviews" aria-label="Next reviews" disabled={loading || Boolean(savingId) || filters.page * 25 >= listing.total} onClick={() => refresh(filters.page + 1)}><ChevronRight size={20} /></button></div>}
    </>}
  </section>
}