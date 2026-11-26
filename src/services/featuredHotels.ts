import type { Hotel } from '../types'

const categoryRanks: Record<string, number> = {
  Premium: 1,
  'Premium Houseboat': 1,
  'Premium Plus': 2,
  Diamond: 3,
  Luxury: 4,
  'Luxury Houseboat': 4,
}

export function selectFeaturedHotels<T extends Pick<Hotel, 'id' | 'category' | 'location' | 'price'>>(hotels: readonly T[]): T[] {
  const ranked = hotels.filter((hotel) => (categoryRanks[hotel.category] ?? 0) > 0)
    .sort((a, b) => categoryRanks[b.category] - categoryRanks[a.category] || a.price - b.price || a.id.localeCompare(b.id))
  const locations = new Set<string>()
  return ranked.filter((hotel) => {
    const location = hotel.location.trim().toLowerCase()
    if (locations.has(location)) return false
    locations.add(location)
    return true
  }).slice(0, 3)
}
