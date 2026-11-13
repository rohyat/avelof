import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, RefreshCw, Star } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ReviewCard from '../components/ReviewCard'
import ReviewCarousel from '../components/ReviewCarousel'
import ReviewStars from '../components/ReviewStars'
import { loadPublicDriverByDisplayId } from '../services/driverService'
import type { PublicDriver } from '../services/driverSchema'
import { reviewSubmissionSchema } from '../services/reviewSchema'
import type { ReviewStatus } from '../services/reviewSchema'
import { loadPublicReviews, ReviewError, saveReview } from '../services/reviewService'

function reviewError(error: unknown) {
  return error instanceof ReviewError ? error.message : 'We could not confirm the driver review request. Please try again.'
}

export default function DriverReviewsPage() {
  const { driverId = '' } = useParams()
  const [driver, setDriver] = useState<PublicDriver | null>(null)
  const [listing, setListing] = useState<Awaited<ReturnType<typeof loadPublicReviews>> | null>(null)
  const [page, setPage] = useState(1)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [rating, setRating] = useState('')
  const [saved, setSaved] = useState<ReviewStatus | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const pending = useRef<{ fingerprint: string; id: string } | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      loadPublicDriverByDisplayId(driverId, controller.signal),
      loadPublicReviews(page, controller.signal, driverId),
    ]).then(([nextDriver, nextListing]) => {
      if (!nextDriver) throw new ReviewError('This approved driver could not be found.', 404)
      setDriver(nextDriver)
      setListing(nextListing)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setDriver(null); setListing(null); setLoadError(reviewError(error)) }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [driverId, page, refreshVersion])

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
      reviewerName: String(fields.get('reviewerName') ?? ''),
      bookingId: String(fields.get('bookingId') ?? ''),
      experience: 'Driver experience',
      driverId,
      rating: Number(fields.get('rating')),
      title: String(fields.get('title') ?? ''),
      reviewText: String(fields.get('reviewText') ?? ''),
      publicationConsent: fields.has('publicationConsent'),
      website: String(fields.get('website') ?? ''),
    }
    const fingerprint = JSON.stringify(details)
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, id: crypto.randomUUID() }
    const parsed = reviewSubmissionSchema.safeParse({ ...details, id: pending.current.id })
    if (!parsed.success) { setSubmitError('Please check your display name, star rating, optional comment and publication consent.'); return }
    inFlight.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      const receipt = await saveReview(parsed.data)
      setSaved(receipt.status)
      refresh(1)
    } catch (error) {
      setSubmitError(reviewError(error))
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return <>
    <section className="page-hero"><div className="page-width">
      <div className="breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/drivers">Our drivers</Link><span>/</span><span>Driver reviews</span></div>
      <p className="eyebrow">AVELOF driver feedback</p><h1>{driver?.fullName ?? 'Driver reviews'}</h1>
      {driver && <p className="driver-review-identity">{driver.driverId} · {driver.vehicleName} · {driver.location}</p>}
    </div></section>
    <section className="reviews-page page-width">
      <Link className="text-link" to="/drivers"><ArrowLeft size={16} /> Back to all drivers</Link>
      {loading && <p role="status">Loading driver reviews...</p>}
      {loadError && <p className="enquiry-error" role="alert">{loadError}</p>}
      {driver && listing && <>
        <div className="driver-review-summary">
          <img src={driver.photo} alt={`Portrait of ${driver.fullName}`} />
          <div><p className="eyebrow">Guest rating</p><ReviewStars rating={listing.averageRating ?? 0} label={listing.averageRating ? `${listing.averageRating.toFixed(1)} out of 5 stars` : 'No driver ratings yet'} /><h2>{listing.averageRating ? `${listing.averageRating.toFixed(1)} out of 5` : 'No ratings yet'}</h2><p>{listing.total} published {listing.total === 1 ? 'review' : 'reviews'} for {driver.fullName}</p></div>
        </div>
        <div className="review-feed-heading"><div><h2>Reviews for this driver</h2><p>Ratings and comments are linked to {driver.driverId}.</p></div><button className="icon-button" onClick={() => refresh()} disabled={loading} title="Refresh driver reviews" aria-label="Refresh driver reviews"><RefreshCw size={18} /></button></div>
        <ReviewCarousel>{listing.reviews.map((review) => <ReviewCard key={review.id} review={review} />)}</ReviewCarousel>
        {!listing.total && <p className="review-empty" role="status">No published reviews yet. Be the first to rate this driver.</p>}
        {listing.total > 25 && <div className="admin-enquiry-pagination"><span>Page {page} of {Math.ceil(listing.total / 25)}</span><button className="icon-button" title="Previous reviews" aria-label="Previous reviews" disabled={loading || page <= 1} onClick={() => refresh(page - 1)}><ChevronLeft size={20} /></button><button className="icon-button" title="Next reviews" aria-label="Next reviews" disabled={loading || page * 25 >= listing.total} onClick={() => refresh(page + 1)}><ChevronRight size={20} /></button></div>}
        <section className="review-submission" id="share-review" aria-labelledby="driver-review-form-title">
          <div><p className="eyebrow">Rate this driver</p><h2 id="driver-review-form-title">Share your experience with {driver.fullName}.</h2><p>A star rating is required. A short comment is optional. Do not include phone numbers, addresses or payment information.</p></div>
          {saved ? <div className="review-ready" role="status"><h3>Thank you. Your driver rating has been saved.</h3><p>Your rating is published and linked to {driver.driverId}.</p><button className="text-link" type="button" onClick={() => { setSaved(null); setRating(''); pending.current = null }}>Add another rating <ArrowRight size={16} /></button></div> : <form className="review-submission-form" onSubmit={submit} aria-busy={submitting}>
            <label>Display name<input name="reviewerName" autoComplete="nickname" maxLength={80} required placeholder="Name to publish" /></label>
            <label>Booking ID (optional, shown publicly)<input name="bookingId" autoComplete="off" maxLength={80} placeholder="Optional booking reference" /></label>
            <label>Review title (optional)<input name="title" maxLength={120} /></label>
            <fieldset className="review-rating"><legend>Your rating</legend><div className="review-star-options">{Array.from({ length: 5 }, (_, index) => { const value = String(index + 1); return <label className={Number(rating) >= Number(value) ? 'is-selected' : ''} key={value}><input aria-label={`${value} star${value === '1' ? '' : 's'}`} type="radio" name="rating" value={value} checked={rating === value} onChange={(event) => setRating(event.target.value)} required /><Star aria-hidden="true" /></label> })}</div></fieldset>
            <label className="review-text-field">Comment (optional)<textarea name="reviewText" rows={5} maxLength={1600} placeholder="Share an optional comment about your driver experience." /></label>
            <label className="enquiry-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            <label className="review-consent"><input type="checkbox" name="publicationConsent" required /><span>I confirm this is my own experience and consent to immediate publication of my display name, star rating, optional comment and booking ID, if provided.</span></label>
            {submitError && <p className="enquiry-error review-text-field" role="alert">{submitError}</p>}
            <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? 'Saving rating...' : 'Submit driver rating'} <ArrowRight size={16} /></button>
          </form>}
        </section>
      </>}
    </section>
  </>
}
