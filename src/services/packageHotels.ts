import type { Hotel, TourPackage } from '../types'

const hotelCategories: Record<string, readonly string[]> = {
  deluxe: ['Deluxe'],
  premium: ['Premium', 'Premium Plus'],
  luxury: ['Diamond', 'Luxury'],
}
const houseboatCategories: Record<string, readonly string[]> = {
  deluxe: ['Deluxe Houseboat'], premium: ['Premium Houseboat'], luxury: ['Luxury Houseboat'],
}

export const packageHotelLimit = 3
const ratingPrior = { rating: 3.5, reviews: 3 }
const scoreWeights = { rating: 0.45, price: 0.35, amenities: 0.2 }

function bayesianRating(hotel: Hotel) {
  const reviews = hotel.hotelReviewCount ?? 0
  const rating = hotel.hotelAverageRating ?? 0
  return reviews > 0 && rating > 0
    ? (ratingPrior.rating * ratingPrior.reviews + rating * reviews) / (ratingPrior.reviews + reviews)
    : ratingPrior.rating
}

// Higher is better: review quality (smoothed so a single review cannot dominate), value for money and amenities.
export function packageHotelScores(hotels: readonly Hotel[]) {
  const prices = hotels.map((hotel) => hotel.price)
  const minPrice = Math.min(...prices)
  const priceRange = Math.max(...prices) - minPrice
  const maxAmenities = Math.max(1, ...hotels.map((hotel) => hotel.facilities.length))
  return new Map(hotels.map((hotel) => [hotel.id,
    scoreWeights.rating * (bayesianRating(hotel) / 5)
    + scoreWeights.price * (priceRange > 0 ? 1 - (hotel.price - minPrice) / priceRange : 1)
    + scoreWeights.amenities * (hotel.facilities.length / maxAmenities)]))
}

export function hotelsForPackageStay(hotels: readonly Hotel[], packageId: string, stay: TourPackage['stays'][number], limit = packageHotelLimit): Hotel[] {
  const propertyType = stay.propertyType ?? 'Hotel'
  const categories = propertyType === 'Houseboat'
    ? houseboatCategories[packageId] ?? []
    : hotelCategories[packageId] ?? []
  const candidates = hotels.filter((hotel) =>
    Boolean(hotel.registeredHotelId)
    && (hotel.propertyType ?? 'Hotel') === propertyType
    && hotel.location.trim().toLowerCase() === stay.location.trim().toLowerCase()
    && categories.includes(hotel.category))
  const scores = packageHotelScores(candidates)
  return candidates
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.price - b.price || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .slice(0, limit)
}

export function packageWithHotelOptions(item: TourPackage, hotels: readonly Hotel[]): TourPackage {
  return { ...item, stays: item.stays.map((stay) => {
    const options = hotelsForPackageStay(hotels, item.id, stay)
    return options.length ? { ...stay, hotel: `Possible stays: ${options.map((hotel) => hotel.name).join(', ')} (subject to availability and confirmation)` } : stay
  }) }
}
