export type CatalogKind = 'package' | 'car' | 'hotel'
export type BookingKind = CatalogKind | 'contact'

export interface Destination {
  id: string
  name: string
  aliases: string[]
  detail: string
  image: string
  count: string
  distance: string
  travelTime: string
  maxDriveHours: number
  suggestedVisit: string
  season: string
  accessNote: string
  attractions: { name: string; detail: string }[]
}

export interface CatalogBase {
  id: string
  name: string
  location: string
  image: string
  gallery: string[]
  category: string
  price: number
  description: string
}

export interface TourPackage extends CatalogBase {
  kind: 'package'
  originalPrice?: number
  underDevelopment?: boolean
  duration: string
  itinerary: { day: string; title: string; detail: string }[]
  stay: string
  stays: { location: string; nights: number; hotel: string }[]
  transport: string
  experiences: string[]
  inclusions: string[]
  exclusions: string[]
}

export interface RentalCar extends CatalogBase {
  kind: 'car'
  priceOnEnquiry?: boolean
  photoCredit?: { author: string; source: string; license: string; licenseUrl: string }
  seats: number
  luggage: string
  ac: boolean
  tripTypes: string[]
  conditions: string[]
}

export interface Hotel extends CatalogBase {
  kind: 'hotel'
  roomOnlyPrice?: number
  rateBasis?: string
  mealPlan?: string
  packageId?: string
  roomTypes: string[]
  facilities: string[]
  checkIn: string
  checkOut: string
  highlights: string[]
}

export type CatalogItem = TourPackage | RentalCar | Hotel

export interface VerifiedGuestRating {
  id: string
  name: string
  rating: number
  packageName: string
  bookingId: string
  reviewTitle: string
  reviewText: string
}

export interface BookingPayload {
  kind: BookingKind
  fields: Record<string, string>
}

export interface PreparedRequest {
  reference: string
  subject: string
  message: string
  whatsappUrl: string
}