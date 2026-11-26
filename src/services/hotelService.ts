import { z } from 'zod'
import { useEffect, useState } from 'react'
import { adminHotelSchema, hotelReceiptSchema, hotelStatusResultSchema, publicHotelSchema } from './hotelSchema'
import { hotelPhotoCount, hotelPhotoDimension, hotelPhotoLimit, hotelRoomMealMultiplier, hotelRoomRateBasis } from '../data/hotelRegistration'
import type { HotelRoomRate, HotelSubmission, HotelStatus, PublicHotel } from './hotelSchema'
import type { Hotel } from '../types'
import type { MapCoordinates } from './mapLocation'
import { locationFields } from './mapLocation'
import { hotelRoomPriceForDate } from './hotelPricing'
import { orderHotelsForVisit } from './hotelOrdering'
import type { Region } from '../data/regions'
import { listingRegion } from '../data/regions'

const pagination = { total: z.number().int().min(0), page: z.number().int().min(1), pageSize: z.literal(25) }
const publicList = z.object({ ...pagination, hotels: z.array(publicHotelSchema) })
const adminList = z.object({ ...pagination, hotels: z.array(adminHotelSchema) })
export type OwnerHotel = z.infer<typeof hotelStatusResultSchema>
export type HotelReceipt = z.infer<typeof hotelReceiptSchema>

export class HotelError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
export const hotelErrorText = (error: unknown) => error instanceof HotelError ? error.message : 'The hotel request could not be confirmed. Please try again.'

export async function requestHotel(url: string, method = 'GET', body?: FormData | Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
  const multipart = body instanceof FormData
  const response = await fetch(url, {
    method, credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body), ...(multipart ? {} : { headers: { 'Content-Type': 'application/json' } }) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
  })
  if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
    if (response.ok) throw new HotelError('The registration API is not connected to this preview. Run npm run build, then npm run dev:cloudflare, and open the Pages preview URL.', 503)
    throw new HotelError(`The registration service is unavailable (HTTP ${response.status}). Please try again later or contact AVELOF.`, response.status)
  }
  const data: unknown = await response.json().catch(() => null)
  if (data === null) throw new HotelError('The registration service returned an invalid response. Please try again or contact AVELOF.', 502)
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'The hotel request failed. Please try again.'
    throw new HotelError(message, response.status)
  }
  return data
}

export async function saveHotel(details: HotelSubmission, photos: Blob[]) {
  const body = new FormData()
  body.append('details', JSON.stringify(details))
  photos.forEach((photo, index) => body.append('photos', photo, `hotel-${index + 1}.jpg`))
  const receipt = hotelReceiptSchema.parse(await requestHotel('/api/hotels', 'POST', body))
  if (receipt.id !== details.id) throw new HotelError('Hotel storage could not be confirmed. Retry with the same form.', 503)
  return receipt
}
export async function lookupHotel(identifier: string, accessCode: string) {
  return z.object({ hotel: hotelStatusResultSchema }).parse(await requestHotel('/api/hotel-status', 'POST', { identifier, accessCode })).hotel
}
export async function updateHotel(details: HotelSubmission, version: number, accessCode: string, photos: Blob[], retainedPhotos?: number[]) {
  const body = new FormData()
  body.append('details', JSON.stringify(details))
  body.append('auth', JSON.stringify({ version, accessCode }))
  if (retainedPhotos !== undefined) body.append('retainedPhotos', JSON.stringify(retainedPhotos))
  photos.forEach((photo, index) => body.append('photos', photo, `hotel-${index + 1}.jpg`))
  const receipt = hotelReceiptSchema.parse(await requestHotel('/api/hotel-update', 'POST', body))
  if (receipt.id !== details.id || receipt.status !== 'pending') throw new HotelError('Hotel update could not be confirmed. Retry with the same form.', 503)
  return receipt
}
export async function loadAdminHotels(page: number, status: HotelStatus | 'all', signal?: AbortSignal) {
  return adminList.parse(await requestHotel(`/api/hotels?${new URLSearchParams({ scope: 'admin', page: String(page), status })}`, 'GET', undefined, signal))
}
export async function moderateHotel(id: string, version: number, status: HotelStatus, price: number, ownerNote: string, breakfastPrice?: number, dinnerPrice?: number, roomRates?: HotelRoomRate[], coordinates?: MapCoordinates | null, hotColdAc?: boolean, extraBedPrice?: number) {
  return z.object({ hotel: adminHotelSchema }).parse(await requestHotel('/api/hotels', 'PATCH', { id, version, status, price, ownerNote, breakfastPrice, dinnerPrice, extraBedPrice, roomRates, hotColdAc, ...(coordinates === undefined ? {} : locationFields(coordinates ?? undefined)) })).hotel
}
export async function deleteHotel(id: string, version: number) {
  return z.object({ deleted: z.literal(true), id: z.uuidv4() }).parse(await requestHotel('/api/hotels', 'DELETE', { id, version }))
}
export async function loadPublicHotels(signal?: AbortSignal, id?: string, region: Region = 'Kashmir') {
  const hotels: PublicHotel[] = []
  let page = 1
  while (true) {
    const query = new URLSearchParams({ page: String(page), region, ...(id ? { id } : {}) })
    const listing = publicList.parse(await requestHotel(`/api/hotels?${query}`, 'GET', undefined, signal))
    hotels.push(...listing.hotels.filter((hotel) => listingRegion(hotel) === region))
    if (page * listing.pageSize >= listing.total) return hotels
    page++
  }
}
export function toCatalogHotel(hotel: PublicHotel): Hotel {
  return {
    kind: 'hotel', id: hotel.id, registeredHotelId: hotel.hotelId, propertyType: hotel.propertyType ?? 'Hotel',
    hotelAverageRating: hotel.averageRating, hotelReviewCount: hotel.reviewCount,
    name: hotel.name, location: hotel.location, exactLocation: hotel.exactLocation, category: hotel.category, price: hotel.price, originalPrice: hotel.originalPrice, discountPercent: hotel.discountPercent,
    latitude: hotel.latitude, longitude: hotel.longitude,
    image: hotel.photos[0], gallery: hotel.photos,
    description: hotel.description, rateBasis: hotelRoomRateBasis(selectedHotelRoom(hotel)?.roomType),
    mealPlan: hotel.mealPlan, totalRooms: hotel.totalRooms,
    ...(hotel.breakfastPrice !== undefined && hotel.dinnerPrice !== undefined ? { roomOnlyPrice: hotel.price, breakfastPrice: hotel.breakfastPrice, dinnerPrice: hotel.dinnerPrice } : {}),
    ...(hotel.extraBedPrice ? { extraBedPrice: hotel.extraBedPrice } : {}),
    roomTypes: hotel.roomTypes, roomRates: hotel.roomRates, hotColdAc: hotel.hotColdAc ?? hotel.heating === 'Hot & cold AC',
    facilities: [...new Set([...(hotel.heating === 'Hot & cold AC' ? [] : [hotel.heating]), ...((hotel.hotColdAc ?? hotel.heating === 'Hot & cold AC') ? ['Hot & cold AC'] : []), ...hotel.amenities])],
    checkIn: hotel.checkIn, checkOut: hotel.checkOut, highlights: hotel.highlights,
  }
}
export async function loadPublicHotelByDisplayId(hotelId: string, signal?: AbortSignal) {
  const listing = publicList.parse(await requestHotel(`/api/hotels?${new URLSearchParams({ hotelId })}`, 'GET', undefined, signal))
  return listing.hotels[0] ?? null
}
export function useRegisteredHotels(enabled: boolean, id?: string, region: Region = 'Kashmir') {
  const key = enabled ? `${region}:${id ?? 'all'}` : ''
  const [state, setState] = useState<{ key: string; hotels: Hotel[]; loading: boolean; error: string }>({ key: '', hotels: [], loading: enabled, error: '' })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const refresh = () => { if (enabled) { setState({ key, hotels: [], loading: true, error: '' }); setRevision((value) => value + 1) } }
    window.addEventListener('focus', refresh)
    window.addEventListener('avelof-pricing-updated', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('avelof-pricing-updated', refresh) }
  }, [enabled, key])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    loadPublicHotels(controller.signal, id, region).then((hotels) => {
      setState({ key, hotels: orderHotelsForVisit(hotels).map(toCatalogHotel), loading: false, error: '' })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ key, hotels: [], loading: false, error: hotelErrorText(error) })
    })
    return () => controller.abort()
  }, [enabled, id, key, region, revision])
  const visible = state.key === key ? state : { hotels: [], loading: enabled, error: '' }
  return { ...visible, reload: () => { setState({ key, hotels: [], loading: true, error: '' }); setRevision((current) => current + 1) } }
}
export const hotelSelectionValue = (hotel: Hotel) => hotel.registeredHotelId ? `${hotel.name} (${hotel.registeredHotelId})` : hotel.name
export function hotelsInLocation(hotels: Hotel[], locationNames: string[]) {
  return hotels.filter((hotel) => locationNames.some((name) => hotel.location.toLowerCase().includes(name.toLowerCase())))
}
export const includedHotelMeals = (hotel: Hotel) => ({
  ...(hotel.breakfastPrice !== undefined ? { breakfast: false, dinner: false } : {
  breakfast: hotel.mealPlan !== 'Room only',
  dinner: hotel.mealPlan === 'Breakfast and dinner included' || hotel.mealPlan === 'All meals included',
  }),
})
export function selectedHotelRoom(hotel: Pick<Hotel, 'roomRates'>, roomType?: string) {
  return hotel.roomRates?.find((room) => room.roomType === roomType)
    ?? hotel.roomRates?.reduce((lowest, room) => room.price < lowest.price ? room : lowest)
}
export const hotelExtraBedPrice = (hotel: Pick<Hotel, 'extraBedPrice'>) => hotel.extraBedPrice && hotel.extraBedPrice > 0 ? hotel.extraBedPrice : 0
export function hotelExtraBedTotal(hotel: Hotel, breakfast: boolean, dinner: boolean) {
  const bed = hotelExtraBedPrice(hotel)
  if (!bed) return 0
  const meals = hotelMealPrices(hotel)
  const multiplier = hotelRoomMealMultiplier(selectedHotelRoom(hotel)?.roomType)
  return Math.round((bed + (breakfast ? meals.breakfast / multiplier / 2 : 0) + (dinner ? meals.dinner / multiplier / 2 : 0)) * 100) / 100
}
export const hotelNightlyPrice = (hotel: Hotel, breakfast: boolean, dinner: boolean, roomType?: string, date?: string, extraBed = false) => {
  const base = hotelRoomPriceForDate(selectedHotelRoom(hotel, roomType)?.price ?? hotel.roomOnlyPrice ?? hotel.price, date)
  const meals = hotelMealPrices(hotel, roomType)
  const mealTotal = Math.round(((breakfast ? meals.breakfast : 0) + (dinner ? meals.dinner : 0) + (extraBed ? hotelExtraBedTotal(hotel, breakfast, dinner) : 0)) * 100) / 100
  const subtotal = Math.round((base + mealTotal) * 100) / 100
  return subtotal
}
export function hotelMealPrices(hotel: Hotel, roomType?: string) {
  const multiplier = hotelRoomMealMultiplier(selectedHotelRoom(hotel, roomType)?.roomType)
  const legacyMeal = (hotel.price - (hotel.roomOnlyPrice ?? hotel.price)) / 2
  return {
    breakfast: Math.round((hotel.breakfastPrice ?? legacyMeal) * multiplier * 100) / 100,
    dinner: Math.round((hotel.dinnerPrice ?? legacyMeal) * multiplier * 100) / 100,
  }
}

export async function compressHotelPhotos(files: File[]) {
  if (!files.length) throw new HotelError('Select at least one photo.', 400)
  const selected = files.slice(0, hotelPhotoCount)
  if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5000000)) throw new HotelError('Use JPEG, PNG or WebP photos, each no larger than 5 MB.', 400)
  const photos: Blob[] = new Array(selected.length)
  let nextIndex = 0
  async function compress(file: File) {
    let image: ImageBitmap
    try { image = await createImageBitmap(file) }
    catch { throw new HotelError(`Could not read ${file.name}. Choose a valid photo.`, 400) }
    try {
      if (image.width * image.height > 40000000) throw new HotelError('Photo resolution is too large. Choose a smaller image.', 400)
      const scale = Math.min(1, hotelPhotoDimension / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new HotelError('Photo processing is unavailable in this browser.', 503)
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      let photo: Blob | null = null
      for (const quality of [0.85, 0.78, 0.7]) {
        photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
        if (photo && photo.size <= 350000) break
      }
      if (!photo || photo.size > hotelPhotoLimit) throw new HotelError('This photo could not be compressed enough. Choose a smaller image.', 400)
      return photo
    } finally { image.close() }
  }
  async function worker() {
    while (nextIndex < selected.length) {
      const index = nextIndex++
      photos[index] = await compress(selected[index])
    }
  }
  const results = await Promise.allSettled(Array.from({ length: Math.min(2, selected.length) }, () => worker()))
  const failure = results.find((result) => result.status === 'rejected')
  if (failure?.status === 'rejected') throw failure.reason
  return photos
}
