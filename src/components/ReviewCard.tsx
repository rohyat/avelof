import ReviewStars from './ReviewStars'
import type { PublicReview } from '../services/reviewSchema'

function reviewMonthLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
}

export default function ReviewCard({ review }: { review: PublicReview }) {
  return <article id={`guest-review-${review.id}`} className="review-card">
    <div className="review-card-head"><div className="review-card-identity"><strong>{review.reviewerName || 'Anonymous guest'}</strong>{review.bookingId && <span className="review-booking-id">Booking ID: {review.bookingId}</span>}{review.driverId && <span className="review-booking-id">Driver ID: {review.driverId}</span>}{review.hotelId && <span className="review-booking-id">Hotel ID: {review.hotelId}</span>}</div><span className="review-source-label">Guest review</span></div>
    <ReviewStars rating={review.rating} />
    {review.title && <h3 className="review-card-title">{review.title}</h3>}
    {review.reviewText && <blockquote>{review.reviewText}</blockquote>}
    <div className="review-card-footer"><span>{review.experience}</span><small><time dateTime={review.reviewMonth || review.publishedAt}>{review.reviewMonth ? `Reviewed ${reviewMonthLabel(review.reviewMonth)}` : `Published ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(review.publishedAt))}`}</time></small></div>
  </article>
}
