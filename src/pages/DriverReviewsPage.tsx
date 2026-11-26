import BackButton from '../components/BackButton'
import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ReviewCard from '../components/ReviewCard'
import ReviewCarousel from '../components/ReviewCarousel'
import ReviewStars from '../components/ReviewStars'
import WritePartnerReview from '../components/WritePartnerReview'
import { hotelCategoryLabel, hotelLocationLabel } from '../data/hotelRegistration'
import { loadPublicDriverByDisplayId } from '../services/driverService'
import { loadPublicHotelByDisplayId } from '../services/hotelService'
import { loadPublicReviews, ReviewError } from '../services/reviewService'
import { listingRegion, regionBasePath, regionFromPath, regionHomePath } from '../data/regions'

export default function DriverReviewsPage() {
  const { driverId = '', hotelId = '' } = useParams()
  const location = useLocation()
  const reviewKind = /\/hotels\//.test(location.pathname) ? 'hotel' : 'driver'
  const region = regionFromPath(location.pathname)
  const directoryPath = `${regionBasePath(region)}/${reviewKind === 'hotel' ? 'hotels' : 'drivers'}`
  const subjectId = reviewKind === 'hotel' ? hotelId : driverId
  const [subject, setSubject] = useState<{ name: string; displayId: string; description: string; photo: string } | null>(null)
  const [listing, setListing] = useState<Awaited<ReturnType<typeof loadPublicReviews>> | null>(null)
  const [page, setPage] = useState(1)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const subjectRequest = reviewKind === 'hotel'
      ? loadPublicHotelByDisplayId(subjectId, controller.signal).then((hotel) => hotel && listingRegion(hotel) === region && ({ name: hotel.name, displayId: hotel.hotelId, description: `${hotelCategoryLabel(hotel.category)} · ${hotelLocationLabel(hotel)}`, photo: hotel.photos[0] }))
      : loadPublicDriverByDisplayId(subjectId, controller.signal).then((driver) => driver && listingRegion(driver) === region && ({ name: driver.fullName, displayId: driver.driverId, description: `${driver.vehicleName} · ${driver.location}`, photo: driver.photo }))
    Promise.all([
      subjectRequest,
      loadPublicReviews(page, controller.signal, reviewKind === 'hotel' ? { hotelId: subjectId } : { driverId: subjectId }),
    ]).then(([nextSubject, nextListing]) => {
      if (controller.signal.aborted) return
      if (!nextSubject) throw new ReviewError(`This approved ${reviewKind} could not be found.`, 404)
      setSubject(nextSubject)
      setListing(nextListing)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setSubject(null)
        setListing(null)
        setLoadError(error instanceof ReviewError ? error.message : 'Reviews could not be loaded. Please try again.')
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, refreshVersion, reviewKind, subjectId, region])

  function refresh(nextPage = page) {
    setLoading(true)
    setLoadError('')
    setPage(nextPage)
    setRefreshVersion((current) => current + 1)
  }

  return <>
    <section className="page-hero"><div className="page-width">
      <div className="breadcrumb"><BackButton /><Link to={regionHomePath(region)}>Home</Link><span>/</span><Link to={directoryPath}>{reviewKind === 'hotel' ? 'Hotels' : 'Our drivers'}</Link><span>/</span><span>{reviewKind === 'hotel' ? 'Hotel' : 'Driver'} reviews</span></div>
      <p className="eyebrow">AVELOF {reviewKind} feedback</p><h1>{subject?.name ?? `${reviewKind === 'hotel' ? 'Hotel' : 'Driver'} reviews`}</h1>
      {subject && <p className="driver-review-identity">{subject.displayId} · {subject.description}</p>}
    </div></section>
    <section className="reviews-page page-width">
      <Link className="text-link" to={directoryPath}><ArrowLeft size={16} /> Back to all {reviewKind === 'hotel' ? 'hotels' : 'drivers'}</Link>
      {loading && <p role="status">Loading {reviewKind} reviews...</p>}
      {loadError && <p className="enquiry-error" role="alert">{loadError} <button type="button" className="text-link" onClick={() => refresh()}>Retry reviews</button></p>}
      {subject && listing && <>
        <div className="driver-review-summary">
          <img src={subject.photo} alt={reviewKind === 'hotel' ? `${subject.name}, hotel-provided photo` : `Portrait of ${subject.name}`} />
          <div><p className="eyebrow">Guest rating</p><ReviewStars rating={listing.averageRating ?? 0} label={listing.averageRating ? `${listing.averageRating.toFixed(1)} out of 5 stars` : `No ${reviewKind} ratings yet`} /><h2>{listing.averageRating ? `${listing.averageRating.toFixed(1)} out of 5` : 'No ratings yet'}</h2><p>{listing.total} published {listing.total === 1 ? 'review' : 'reviews'} for {subject.name}</p></div>
        </div>
        <div className="review-feed-heading"><div><h2>Reviews for this {reviewKind}</h2><p>Ratings and comments are linked to {subject.displayId}.</p></div><button className="icon-button" onClick={() => refresh()} disabled={loading} title={`Refresh ${reviewKind} reviews`} aria-label={`Refresh ${reviewKind} reviews`}><RefreshCw size={18} /></button></div>
        <WritePartnerReview key={subject.displayId} kind={reviewKind} subjectId={subject.displayId} name={subject.name} initiallyOpen={location.hash === '#share-review'} onPublished={() => refresh(1)} />
        <ReviewCarousel>{listing.reviews.map((review) => <ReviewCard key={review.id} review={review} />)}</ReviewCarousel>
        {!listing.total && <p className="review-empty" role="status">No published reviews yet. Be the first to rate this {reviewKind}.</p>}
        {listing.total > 25 && <div className="admin-enquiry-pagination"><span>Page {page} of {Math.ceil(listing.total / 25)}</span><button className="icon-button" title="Previous reviews" aria-label="Previous reviews" disabled={loading || page <= 1} onClick={() => refresh(page - 1)}><ChevronLeft size={20} /></button><button className="icon-button" title="Next reviews" aria-label="Next reviews" disabled={loading || page * 25 >= listing.total} onClick={() => refresh(page + 1)}><ChevronRight size={20} /></button></div>}
      </>}
    </section>
  </>
}
