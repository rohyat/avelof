export type CatalogKind = 'package' | 'car' | 'hotel'
export type BookingKind = CatalogKind | 'contact'

export interface Destination {
  id: string
  name: string
  aliases: string[]
  detail: string
  image: string
  photoIsUserProvided?: boolean
  additionalPhotos?: { image: string; alt: string }[]
  photoCredit?: { author: string; source: string; licenseUrl: string }
  count: string
  distance: string
  travelTime: string
  maxDriveHours: number
  suggestedVisit: string
  season: string
  accessNote: string
  attractions: { name: string; detail: string }[]
}

interface CatalogBase {
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
  registeredDriverId?: string
  driverDisplayName?: string
  driverPhoto?: string
  maskedPhone?: string
  taxDetails?: string
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
  registeredHotelId?: string
  taxDetails?: string
  totalRooms?: number
  roomOnlyPrice?: number
  breakfastPrice?: number
  dinnerPrice?: number
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

export interface OwnerProvidedGuestReview {
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

export type BookingStatus = 'received' | 'booked' | 'running' | 'completed'

interface RequestedBookingDetails {
  type: string
  name: string
  startLabel: string
  endLabel: string
  startDate: string | null
  endDate: string | null
}

export interface BookingSummary {
  reference: string
  kind: BookingKind
  status: BookingStatus
  maskedName: string
  maskedPhone: string
  bookingDetails: RequestedBookingDetails
}

export interface EnquirySummary {
  reference: string
  kind: BookingKind
  status: BookingStatus
  statusVersion: number
  statusUpdatedAt: string | null
  createdAt: string
  fields: Record<string, string>
}