import { z } from 'zod'
import { hotelModerationSchema, hotelSubmissionSchema } from '../../src/services/hotelSchema.ts'
import { hotelPhotoCount, hotelUploadLimit } from '../../src/data/hotelRegistration.ts'
import { accessConfigured, allowAccessAttempt, hashText, isAdmin, privateReply, sameOrigin } from '../_lib/enquiryAccess.ts'
import { queueOwnerPush } from '../_lib/pushNotifications.ts'
import { adminHotel, deleteRegistrationPhotos, hotelAccessCode, hotelColumns, limitedBody, publicHotel, saveRegistrationPhoto, validHotelJpeg } from '../_lib/hotelRegistration.ts'
import type { HotelEnv, HotelRow } from '../_lib/hotelRegistration.ts'

const listSchema = z.object({
  scope: z.enum(['public', 'admin']).default('public'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  id: z.uuidv4().toLowerCase().optional(),
  status: z.enum(['all', 'pending', 'approved', 'rejected']).default('all'),
}).strict()

export const onRequest: PagesFunction<HotelEnv> = async ({ request, env, waitUntil }) => {
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, PATCH' })
  if (request.method !== 'GET' && !sameOrigin(request)) return privateReply({ error: 'Origin not allowed.' }, 403)
  if (!env.DB) return privateReply({ error: 'Hotel registration storage is unavailable.' }, 503)
  const DB = env.DB
  let uploadedKeys: string[] = []
  let savedToDatabase = false
  let insertingId: string | null = null
  try {
    if (request.method === 'GET') {
      const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
      if (!parsed.success) return privateReply({ error: 'Invalid hotel filters.' }, 400)
      const { scope, page, id, status } = parsed.data
      const admin = scope === 'admin'
      if (admin && !await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      const where = admin ? "WHERE (? = 'all' OR status = ?) AND (? IS NULL OR id = ?)" : "WHERE status = 'approved' AND (? IS NULL OR id = ?)"
      const values = admin ? [status, status, id ?? null, id ?? null] : [id ?? null, id ?? null]
      const total = await DB.prepare(`SELECT count(*) AS total FROM hotel_registrations ${where}`).bind(...values).first<{ total: number }>()
      const rows = await DB.prepare(`SELECT ${hotelColumns} FROM hotel_registrations ${where} ORDER BY created_at DESC, id DESC LIMIT 25 OFFSET ?`).bind(...values, (page - 1) * 25).all<HotelRow>()
      return privateReply({ hotels: rows.results.map(admin ? adminHotel : publicHotel), total: total?.total ?? 0, page, pageSize: 25 })
    }
    if (request.method === 'PATCH') {
      if (!await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return privateReply({ error: 'JSON required.' }, 415)
      const body = await limitedBody(request, 12000)
      if (body === null) return privateReply({ error: 'Hotel update too large.' }, 413)
      let input: unknown
      try { input = JSON.parse(new TextDecoder().decode(body)) } catch { return privateReply({ error: 'Invalid hotel update.' }, 400) }
      const parsed = hotelModerationSchema.safeParse(input)
      if (!parsed.success || (parsed.data.breakfastPrice === undefined) !== (parsed.data.dinnerPrice === undefined)) return privateReply({ error: 'Check the hotel price and moderation details. Supply both meal prices together.' }, 400)
      const { id, version, status, price, ownerNote, breakfastPrice, dinnerPrice } = parsed.data
      const current = await DB.prepare('SELECT details_json FROM hotel_registrations WHERE id = ? AND version = ?').bind(id, version).first<{ details_json: string }>()
      if (!current) return privateReply({ error: 'This hotel changed. Refresh before updating it.' }, 409)
      const details = JSON.parse(current.details_json)
      if (breakfastPrice !== undefined && dinnerPrice !== undefined) Object.assign(details, { breakfastPrice, dinnerPrice, mealPlan: 'Room only' })
      const row = await DB.prepare(`UPDATE hotel_registrations SET status = ?, price = ?, owner_note = ?, details_json = ?, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND version = ? RETURNING ${hotelColumns}`).bind(status, price, ownerNote, JSON.stringify(details), id, version).first<HotelRow>()
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
    if (!parsed.success || parsed.data.website || (parsed.data.breakfastPrice === undefined) !== (parsed.data.dinnerPrice === undefined) || parsed.data.breakfastPrice !== undefined && parsed.data.mealPlan !== 'Room only') return privateReply({ error: 'Check your hotel details, phone number, room-only and meal prices, and publication consent.' }, 400)
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
    const receipt = async (row: HotelRow, status = 200) => privateReply({ saved: true, id: row.id, hotelId: row.hotel_id, status: row.status, accessCode: await hotelAccessCode(env.ENQUIRY_ACCESS_SECRET!, row.hotel_id) }, status)
    if (existing) return existing.id === data.id && existing.payload_hash === payloadHash ? await receipt(existing) : privateReply({ error: 'This phone number or submission ID is already registered. Use private hotel status lookup or contact AVELOF.' }, 409)
    const uploadId = crypto.randomUUID()
    for (const [index, image] of images.entries()) {
      const key = `hotels/${data.id}/${uploadId}/${index}.jpg`
      uploadedKeys.push(key)
      await saveRegistrationPhoto(DB, key, image)
    }
    const hotelId = `AVELOF_HTL_${data.id.replaceAll('-', '').toUpperCase()}`
    const { id, phone, contactName, publicationConsent, website, ...publicDetails } = data
    void publicationConsent
    void website
    insertingId = id
    const row = await DB.prepare(`INSERT INTO hotel_registrations (id, hotel_id, phone, contact_name, details_json, photo_keys_json, submitted_price, price, publication_consent, payload_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?) ON CONFLICT DO NOTHING RETURNING ${hotelColumns}`)
      .bind(id, hotelId, phone, contactName, JSON.stringify(publicDetails), JSON.stringify(uploadedKeys), data.price, data.price, payloadHash).first<HotelRow>()
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
