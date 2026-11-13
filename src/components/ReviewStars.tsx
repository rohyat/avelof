import { Star } from 'lucide-react'

export default function ReviewStars({ rating, label }: { rating: number; label?: string }) {
  const rounded = Math.round(rating)
  return <div className="review-stars" aria-label={label ?? `${rating} out of 5 stars`}>
    {Array.from({ length: 5 }, (_, index) => <Star className={index < rounded ? '' : 'review-empty-star'} key={index} aria-hidden="true" />)}
  </div>
}
