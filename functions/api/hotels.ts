import { z } from 'zod'
import { hotelDetailsSchema, hotelModerationSchema, hotelSubmissionSchema, validHotelRoomRates } from '../../src/services/hotelSchema.ts'
import { hotelLookupIdPattern, hotelPhotoCount, hotelUploadLimit } from '../../src/data/hotelRegistration.ts'
import { accessConfigured, allowAccessAttempt, hashText, isAdmin, privateReply, sameOrigin } from '../_lib/enquiryAccess.ts'
import { queueOwnerPush } from '../_lib/pushNotifications.ts'
import { loadPricingSettings } from '../_lib/pricing.ts'
import { adminHotel, assignHotelId, deleteRegistrationPhotos, hotelAccessCode, hotelColumns, legacyHotelId, limitedBody, publicHotel, resolveHotelId, saveRegistrationPhoto, validHotelJpeg } from '../_lib/hotelRegistration.ts'
import type { HotelEnv, HotelRow } from '../_lib/hotelRegistration.ts'
import { regions } from '../../src/data/regions.ts'
import { listingRegionSql } from '../_lib/regionalListings.ts'
import { fallbackHotels, fallbackHotelsKashmir, fallbackHotelsLadakh } from '../../src/data/fallbackHotels.ts'

const listSchema = z.object({
  scope: z.enum(['public', 'admin']).default('public'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  id: z.uuidv4().toLowerCase().optional(),
  hotelId: z.string().regex(hotelLookupIdPattern).optional(),
  status: z.enum(['all', 'pending', 'approved', 'rejected']).default('all'),
  region: z.enum(regions).optional(),
}).strict()
const deletionSchema = z.object({ id: z.uuidv4().toLowerCase(), version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict()

export const onRequest: PagesFunction<HotelEnv> = async ({ request, env, waitUntil }) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, PATCH, DELETE' })
  if (request.method !== 'GET' && !sameOrigin(request)) return privateReply({ error: 'Origin not allowed.' }, 403)
  if (!env.DB) {
    if (request.method !== 'GET') return privateReply({ error: 'Hotel registration storage is unavailable.' }, 503)
    // For GET requests, serve fallback data
    const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return privateReply({ error: 'Invalid hotel filters.' }, 400)
    const { page, region } = parsed.data
    const hotels = region === 'Ladakh' ? fallbackHotelsLadakh : (region === 'Kashmir' ? fallbackHotelsKashmir : fallbackHotels)
    const pageSize = 25
    const start = (page - 1) * pageSize
    const paginatedHotels = hotels.slice(start, start + pageSize)
    return privateReply({ hotels: paginatedHotels, total: hotels.length, page, pageSize })
  }
  const DB = env.DB
  let uploadedKeys: string[] = []
  let savedToDatabase = false
  let insertingId: string | null = null
  
  // For GET requests, test the database connection with a quick query before proceeding
  if (request.method === 'GET') {
    console.log('Testing database connection...')
    try {
      const testQuery = await DB.prepare('SELECT 1').first()
      console.log('Database connection OK')
      if (!testQuery) throw new Error('DB connection check failed')
    } catch (err) {
      // Database is unavailable, serve fallback data with inline hotels
      const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
      if (!parsed.success) return privateReply({ error: 'Invalid hotel filters.' }, 400)
      const { page, region } = parsed.data
      
      // Inline fallback hotel data - all 5 hotels
      const fallbackHotelsInline = [
        { id: "h1", hotelId: "GUL-001", name: "Chestnuts Houseboat", location: "Gulmarg, Kashmir", exactLocation: "Gulmarg", category: "Luxury", description: "Experience luxury", price: 8500, originalPrice: 12000, discountPercent: 29, latitude: 34.267, longitude: 75.428, photos: ["/hotels/1.jpg"], mealPlan: "Breakfast", totalRooms: 8, checkIn: "2:00 PM", checkOut: "11:00 AM", amenities: ["AC"], highlights: ["Lake"], propertyType: "Houseboat", roomTypes: ["Deluxe"], roomRates: [{ roomType: "Deluxe", price: 7500, meals: "Breakfast" }], hotColdAc: true, averageRating: 4.5, reviewCount: 24 },
        { id: "h2", hotelId: "AHA-001", name: "Aharbal Forest Resort", location: "Aharbal, Kashmir", exactLocation: "Aharbal", category: "Premium", description: "Forest resort", price: 5500, originalPrice: 8000, discountPercent: 31, latitude: 34.329, longitude: 75.445, photos: ["/hotels/2.jpg"], mealPlan: "Breakfast", totalRooms: 12, checkIn: "2:00 PM", checkOut: "11:00 AM", amenities: ["AC"], highlights: ["Forest"], propertyType: "Resort", roomTypes: ["Deluxe"], roomRates: [{ roomType: "Deluxe", price: 6500, meals: "Breakfast" }], hotColdAc: false, averageRating: 4.3, reviewCount: 18 },
        { id: "h3", hotelId: "PAH-001", name: "Pahalgam Valley Inn", location: "Pahalgam, Kashmir", exactLocation: "Pahalgam", category: "Mid-range", description: "Cozy inn", price: 3500, originalPrice: 5000, discountPercent: 30, latitude: 33.939, longitude: 75.531, photos: ["/hotels/3.jpg"], mealPlan: "Room", totalRooms: 15, checkIn: "2:00 PM", checkOut: "11:00 AM", amenities: ["WiFi"], highlights: ["Mountain"], propertyType: "Hotel", roomTypes: ["Standard"], roomRates: [{ roomType: "Standard", price: 3500, meals: "Room" }], hotColdAc: false, averageRating: 4.1, reviewCount: 12 },
        { id: "h4", hotelId: "LEH-001", name: "Himalayan Eco-Lodge", location: "Leh, Ladakh", exactLocation: "Leh", category: "Premium", description: "Eco-lodge", price: 6500, originalPrice: 9000, discountPercent: 28, latitude: 34.164, longitude: 77.577, photos: ["/hotels/4.jpg"], mealPlan: "Breakfast", totalRooms: 10, checkIn: "2:00 PM", checkOut: "11:00 AM", amenities: ["AC"], highlights: ["Mountain"], propertyType: "Lodge", roomTypes: ["Deluxe"], roomRates: [{ roomType: "Deluxe", price: 7500, meals: "Breakfast" }], hotColdAc: true, averageRating: 4.6, reviewCount: 31 },
        { id: "h5", hotelId: "NUB-001", name: "Nubra Valley Camp", location: "Nubra, Ladakh", exactLocation: "Nubra", category: "Mid-range", description: "Desert camp", price: 4000, originalPrice: 5500, discountPercent: 27, latitude: 35.303, longitude: 77.591, photos: ["/hotels/5.jpg"], mealPlan: "All", totalRooms: 20, checkIn: "2:00 PM", checkOut: "11:00 AM", amenities: ["WiFi"], highlights: ["Desert"], propertyType: "Camp", roomTypes: ["Tent"], roomRates: [{ roomType: "Tent", price: 3000, meals: "All" }], hotColdAc: false, averageRating: 4.4, reviewCount: 22 }
      ];
      
      return privateReply({ 
        debug: {
          fallbackCount: fallbackHotelsInline.length,
          region: region,
          testFilter: fallbackHotelsInline.filter(h => h.location.includes('Ladakh')).length,
          allLocations: fallbackHotelsInline.map(h => h.location)
        }
      }, 200)
    }
  }
  
  try {
    if (request.method === 'GET') {
      const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
      if (!parsed.success) return privateReply({ error: 'Invalid hotel filters.' }, 400)
      const { scope, page, id, hotelId, status, region } = parsed.data
      const admin = scope === 'admin'
      if (admin && !await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      const currentHotelId = hotelId ? (await resolveHotelId(DB, hotelId))?.hotel_id ?? hotelId : null
      const where = (admin ? "WHERE (? = 'all' OR status = ?) AND (? IS NULL OR id = ?) AND (? IS NULL OR hotel_id = ?)" : "WHERE status = 'approved' AND (? IS NULL OR id = ?) AND (? IS NULL OR hotel_id = ?)") + ` AND (? IS NULL OR ${listingRegionSql} = ?)`
      const values = admin ? [status, status, id ?? null, id ?? null, currentHotelId, currentHotelId] : [id ?? null, id ?? null, currentHotelId, currentHotelId]
      values.push(region ?? null, region ?? null)
      const total = await DB.prepare(`SELECT count(*) AS total FROM hotel_registrations ${where}`).bind(...values).first<{ total: number }>()
      const listingColumns = admin ? hotelColumns : `${hotelColumns}, (SELECT avg(rating) FROM reviews WHERE reviews.hotel_id = hotel_registrations.hotel_id AND reviews.status = 'published') AS average_rating, (SELECT count(*) FROM reviews WHERE reviews.hotel_id = hotel_registrations.hotel_id AND reviews.status = 'published') AS review_count`
      const rows = await DB.prepare(`SELECT ${listingColumns} FROM hotel_registrations ${where} ORDER BY created_at DESC, id DESC LIMIT 25 OFFSET ?`).bind(...values, (page - 1) * 25).all<HotelRow>()
      const discountPercent = admin ? 0 : (await loadPricingSettings(DB)).discountPercent
      return privateReply({ hotels: rows.results.map((row) => admin ? adminHotel(row) : publicHotel(row, discountPercent)), total: total?.total ?? 0, page, pageSize: 25 })
    }
    if (request.method === 'PATCH' || request.method === 'DELETE') {
      if (!await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return privateReply({ error: 'JSON required.' }, 415)
      const body = await limitedBody(request, 12000)
      if (body === null) return privateReply({ error: 'Hotel update too large.' }, 413)
      let input: unknown
      try { input = JSON.parse(new TextDecoder().decode(body)) } catch { return privateReply({ error: 'Invalid hotel update.' }, 400) }
      if (request.method === 'DELETE') {
        const parsed = deletionSchema.safeParse(input)
        if (!parsed.success) return privateReply({ error: 'Invalid hotel deletion.' }, 400)
        const deleted = await DB.prepare('DELETE FROM hotel_registrations WHERE id = ? AND version = ? RETURNING id').bind(parsed.data.id, parsed.data.version).first<{ id: string }>()
        if (!deleted) return privateReply({ error: 'This hotel changed or is no longer available. Refresh before deleting it.' }, 409)
        return privateReply({ deleted: true, id: deleted.id })
      }
      const parsed = hotelModerationSchema.safeParse(input)
      if (!parsed.success || (parsed.data.breakfastPrice === undefined) !== (parsed.data.dinnerPrice === undefined)) return privateReply({ error: 'Check the hotel price and moderation details. Supply both meal prices together.' }, 400)
      const { id, version, status, price, ownerNote, breakfastPrice, dinnerPrice, extraBedPrice, roomRates, latitude, longitude, hotColdAc } = parsed.data
      const current = await DB.prepare('SELECT details_json FROM hotel_registrations WHERE id = ? AND version = ?').bind(id, version).first<{ details_json: string }>()
      if (!current) return privateReply({ error: 'This hotel changed. Refresh before updating it.' }, 409)
      const details = hotelDetailsSchema.parse(JSON.parse(current.details_json))
      if (hotColdAc !== undefined) details.hotColdAc = hotColdAc
      if (extraBedPrice !== undefined) details.extraBedPrice = extraBedPrice
      if (details.roomRates && !roomRates) return privateReply({ error: 'Supply the reviewed rate for every available room type.' }, 400)
      if (roomRates) {
        if (!details.roomRates || roomRates.length !== details.roomRates.length || roomRates.some((rate) => !details.roomRates?.some((existing) => existing.roomType === rate.roomType && existing.count === rate.count))) return privateReply({ error: 'Reviewed room types and quantities must match the registration.' }, 400)
        details.roomRates = roomRates
      }
      details.price = price
      if (!validHotelRoomRates(details)) return privateReply({ error: 'The listing price must match the lowest available room rate.' }, 400)
      if (breakfastPrice !== undefined && dinnerPrice !== undefined) Object.assign(details, { breakfastPrice, dinnerPrice, mealPlan: 'Room only' })
      const row = await DB.prepare(`UPDATE hotel_registrations SET status = ?, price = ?, owner_note = ?, details_json = ?, latitude = CASE WHEN ? THEN ? ELSE latitude END, longitude = CASE WHEN ? THEN ? ELSE longitude END, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND version = ? RETURNING ${hotelColumns}`)
        .bind(status, price, ownerNote, JSON.stringify(details), latitude !== undefined ? 1 : 0, latitude ?? null, longitude !== undefined ? 1 : 0, longitude ?? null, id, version).first<HotelRow>()
      if (!row) return privateReply({ error: 'This hotel changed. Refresh before updating it.' }, 409)
      return privateReply({ hotel: adminHotel(row) })
    }
    if (!accessConfigured(env)) return privateReply({ error: 'Hotel private access is not configured.' }, 503)
    if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data;')) return privateReply({ error: 'A hotel form with photos is required.' }, 415)
    if (!await allowAccessAttempt(request, DB, 'hotel-submit', 5)) return privateReply({ error: 'Too many submissions. Try again in ten minutes.' }, 429, { 'Retry-After': '600' })
    const bytes = await limitedBody(request, hotelUploadLimit)
    if (bytes === null) return privateReply({ error: 'Hotel photos are too large. Use the registration form to compress them.' }, 413)
    let form: FormData
    try { form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('Content-Type')! } }).formData() }
    catch { return privateReply({ error: 'Invalid hotel form.' }, 400) }
    if ([...form.keys()].some((key) => !['details', 'photos'].includes(key)) || form.getAll('details').length !== 1) return privateReply({ error: 'Unexpected hotel form fields.' }, 400)
    let details: unknown
    try { details = JSON.parse(String(form.get('details'))) } catch { return privateReply({ error: 'Invalid hotel details.' }, 400) }
    const parsed = hotelSubmissionSchema.safeParse(details)
    if (!parsed.success || !validHotelRoomRates(parsed.data) || parsed.data.website || (parsed.data.breakfastPrice === undefined) !== (parsed.data.dinnerPrice === undefined) || parsed.data.breakfastPrice !== undefined && parsed.data.mealPlan !== 'Room only') return privateReply({ error: 'Check your hotel details, phone number, room-only and meal prices, and publication consent.' }, 400)
    const photos = form.getAll('photos')
    if (photos.length < 1 || photos.length > hotelPhotoCount) return privateReply({ error: 'Upload between one and five hotel photos.' }, 400)
    const images: Uint8Array[] = []
    for (const photo of photos) {
      if (typeof photo === 'string' || photo.type !== 'image/jpeg') return privateReply({ error: 'Hotel photos must be compressed JPEG images.' }, 400)
      const image = new Uint8Array(await photo.arrayBuffer())
      if (!validHotelJpeg(image)) return privateReply({ error: 'Invalid or oversized hotel photo. Please select it again using the registration form.' }, 400)
      images.push(image)
    }
    const data = parsed.data
    const photoHashes = await Promise.all(images.map(async (image) => {
      const digest = await crypto.subtle.digest('SHA-256', image)
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    }))
    const payloadHash = await hashText(JSON.stringify({ data, photoHashes }))
    const existing = await DB.prepare(`SELECT ${hotelColumns} FROM hotel_registrations WHERE id = ? OR phone = ?`).bind(data.id, data.phone).first<HotelRow>()
    const receipt = async (row: HotelRow, status = 200) => {
      const assigned = await assignHotelId(DB, row)
      if (!assigned) return privateReply({ error: 'Hotel ID could not be assigned.' }, 503)
      return privateReply({ saved: true, id: assigned.id, hotelId: assigned.hotel_id, status: assigned.status, accessCode: hotelAccessCode(assigned) }, status)
    }
    if (existing) return existing.id === data.id && existing.payload_hash === payloadHash ? await receipt(existing) : privateReply({ error: 'This phone number or submission ID is already registered. Use private hotel status lookup or contact AVELOF.' }, 409)
    const uploadId = crypto.randomUUID()
    for (const [index, image] of images.entries()) {
      const key = `hotels/${data.id}/${uploadId}/${index}.jpg`
      uploadedKeys.push(key)
      await saveRegistrationPhoto(DB, key, image)
    }
    const hotelId = legacyHotelId(data.id)
    const { id, phone, contactName, publicationConsent, website, latitude, longitude, ...publicDetails } = data
    void publicationConsent
    void website
    insertingId = id
    const row = await DB.prepare(`INSERT INTO hotel_registrations (id, hotel_id, phone, contact_name, details_json, photo_keys_json, submitted_price, price, publication_consent, payload_hash, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING ${hotelColumns}`)
      .bind(id, hotelId, phone, contactName, JSON.stringify(publicDetails), JSON.stringify(uploadedKeys), data.price, data.price, payloadHash, latitude ?? null, longitude ?? null).first<HotelRow>()
    if (!row) {
      await deleteRegistrationPhotos(DB, uploadedKeys)
      uploadedKeys = []
      const concurrent = await DB.prepare(`SELECT ${hotelColumns} FROM hotel_registrations WHERE id = ?`).bind(id).first<HotelRow>()
      return concurrent?.payload_hash === payloadHash ? await receipt(concurrent) : privateReply({ error: 'This phone number or submission ID was just registered. Use private hotel status lookup.' }, 409)
    }
    savedToDatabase = true
    queueOwnerPush(env, waitUntil, { title: 'New hotel registration', body: 'A hotel is awaiting your approval.', url: '/admin/panel/hotels', tag: `hotel-${id}` })
    return await receipt(row, 201)
  } catch (error) {
    console.error('Hotel registration request failed', error)
    if (!savedToDatabase && uploadedKeys.length) {
      try {
        const persisted = insertingId ? await DB.prepare('SELECT photo_keys_json FROM hotel_registrations WHERE id = ?').bind(insertingId).first<{ photo_keys_json: string }>() : null
        const persistedKeys = persisted ? z.array(z.string()).parse(JSON.parse(persisted.photo_keys_json)) : []
        const unreferenced = uploadedKeys.filter((key) => !persistedKeys.includes(key))
        await deleteRegistrationPhotos(DB, unreferenced)
      }
      catch (cleanupError) { console.error('Hotel registration left unreferenced D1 photos', cleanupError) }
    }
    return privateReply({ error: 'Hotel registration could not be confirmed. Please retry with the same form.' }, 503)
  }
}
