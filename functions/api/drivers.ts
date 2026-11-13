import { z } from 'zod'
import { driverSubmissionSchema } from '../../src/services/driverSchema.ts'
import { hotelLookupSchema, hotelModerationSchema } from '../../src/services/hotelSchema.ts'
import { hotelUploadLimit } from '../../src/data/hotelRegistration.ts'
import { indianPhoneNumber } from '../../src/services/phoneNumbers.ts'
import { accessConfigured, allowAccessAttempt, equalHashes, hashText, isAdmin, privateReply, sameOrigin } from '../_lib/enquiryAccess.ts'
import { adminDriver, driverAccessCode, driverColumns, publicDriver } from '../_lib/driverRegistration.ts'
import type { DriverRow } from '../_lib/driverRegistration.ts'
import { deleteRegistrationPhotos, limitedBody, saveRegistrationPhoto, validHotelJpeg } from '../_lib/hotelRegistration.ts'
import type { HotelEnv } from '../_lib/hotelRegistration.ts'
import { queueOwnerPush } from '../_lib/pushNotifications.ts'

const listSchema = z.object({ scope: z.enum(['public', 'admin']).default('public'), page: z.coerce.number().int().min(1).max(10000).default(1), id: z.uuidv4().optional(), driverId: z.string().regex(/^AVELOF_DRV_[A-F0-9]{32}$/).optional(), status: z.enum(['all', 'pending', 'approved', 'rejected']).default('all') }).strict()
const moderationSchema = hotelModerationSchema.omit({ breakfastPrice: true, dinnerPrice: true })
export const onRequest: PagesFunction<HotelEnv> = async ({ request, env, waitUntil }) => {
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405)
  if (request.method !== 'GET' && !sameOrigin(request)) return privateReply({ error: 'Origin not allowed.' }, 403)
  if (!env.DB) return privateReply({ error: 'Driver storage is unavailable.' }, 503)
  const DB = env.DB
  let keys: string[] = []
  let saved = false
  let insertingId: string | null = null
  try {
    if (request.method === 'GET') {
      const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
      if (!parsed.success) return privateReply({ error: 'Invalid driver filters.' }, 400)
      const { scope, page, status, id, driverId } = parsed.data
      const admin = scope === 'admin'
      if (admin && !await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      const where = admin ? "WHERE (? = 'all' OR status = ?) AND (? IS NULL OR id = ?) AND (? IS NULL OR driver_id = ?)" : "WHERE status = 'approved' AND (? IS NULL OR id = ?) AND (? IS NULL OR driver_id = ?)"
      const values = admin ? [status, status, id ?? null, id ?? null, driverId ?? null, driverId ?? null] : [id ?? null, id ?? null, driverId ?? null, driverId ?? null]
      const total = await DB.prepare(`SELECT count(*) AS total FROM driver_registrations ${where}`).bind(...values).first<{ total: number }>()
      const listingColumns = admin ? driverColumns : `${driverColumns}, (SELECT avg(rating) FROM reviews WHERE reviews.driver_id = driver_registrations.driver_id AND reviews.status = 'published') AS average_rating, (SELECT count(*) FROM reviews WHERE reviews.driver_id = driver_registrations.driver_id AND reviews.status = 'published') AS review_count`
      const rows = await DB.prepare(`SELECT ${listingColumns} FROM driver_registrations ${where} ORDER BY created_at DESC, id DESC LIMIT 25 OFFSET ?`).bind(...values, (page - 1) * 25).all<DriverRow>()
      return privateReply({ drivers: rows.results.map(admin ? adminDriver : publicDriver), total: total?.total ?? 0, page, pageSize: 25 })
    }
    if (request.method === 'PATCH' || request.headers.get('Content-Type')?.split(';')[0] === 'application/json') {
      if (request.method === 'PATCH' && !await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return privateReply({ error: 'JSON required.' }, 415)
      const bytes = await limitedBody(request, 12000)
      if (bytes === null) return privateReply({ error: 'Request too large.' }, 413)
      let input: unknown
      try { input = JSON.parse(new TextDecoder().decode(bytes)) } catch { return privateReply({ error: 'Invalid driver request.' }, 400) }
      if (request.method === 'PATCH') {
        const parsed = moderationSchema.safeParse(input)
        if (!parsed.success) return privateReply({ error: 'Check driver price and status.' }, 400)
        const { id, version, status, price, ownerNote } = parsed.data
        const row = await DB.prepare(`UPDATE driver_registrations SET status = ?, price = ?, owner_note = ?, version = version + 1 WHERE id = ? AND version = ? RETURNING ${driverColumns}`).bind(status, price, ownerNote, id, version).first<DriverRow>()
        return row ? privateReply({ driver: adminDriver(row) }) : privateReply({ error: 'This driver changed. Refresh before updating.' }, 409)
      }
      if (!accessConfigured(env)) return privateReply({ error: 'Private driver access is unavailable.' }, 503)
      if (!await allowAccessAttempt(request, DB, 'driver-lookup', 10)) return privateReply({ error: 'Too many attempts. Try again in ten minutes.' }, 429)
      const parsed = hotelLookupSchema.safeParse(input)
      if (!parsed.success) return privateReply({ error: 'Enter driver ID or phone and private access code.' }, 400)
      const identifier = parsed.data.identifier.toUpperCase()
      const phone = indianPhoneNumber(identifier)
      if (!phone && !/^AVELOF_DRV_[A-F0-9]{32}$/.test(identifier)) return privateReply({ error: 'Invalid driver ID or phone.' }, 400)
      const row = await DB.prepare(`SELECT ${driverColumns} FROM driver_registrations WHERE driver_id = ? OR phone = ?`).bind(identifier, phone || null).first<DriverRow>()
      if (!row || !equalHashes(await driverAccessCode(env.ENQUIRY_ACCESS_SECRET!, row.driver_id), parsed.data.accessCode)) return privateReply({ error: 'No matching driver and private access code.' }, 404)
      const { photo, version, ...driver } = adminDriver(row)
      void photo; void version
      return privateReply({ driver })
    }
    if (!accessConfigured(env)) return privateReply({ error: 'Private partner access is not configured.' }, 503)
    if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data;')) return privateReply({ error: 'A driver form with photos is required.' }, 415)
    if (!await allowAccessAttempt(request, DB, 'driver-submit', 5)) return privateReply({ error: 'Too many registrations. Try again in ten minutes.' }, 429)
    const bytes = await limitedBody(request, hotelUploadLimit)
    if (bytes === null) return privateReply({ error: 'Driver portrait upload is too large.' }, 413)
    let form: FormData
    try { form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('Content-Type')! } }).formData() } catch { return privateReply({ error: 'Invalid driver form.' }, 400) }
    if ([...form.keys()].some((key) => !['details', 'photos'].includes(key)) || form.getAll('details').length !== 1) return privateReply({ error: 'Unexpected driver fields.' }, 400)
    let input: unknown
    try { input = JSON.parse(String(form.get('details'))) } catch { return privateReply({ error: 'Invalid driver details.' }, 400) }
    const parsed = driverSubmissionSchema.safeParse(input)
    if (!parsed.success || parsed.data.website) return privateReply({ error: 'Check driver details, age, licence, vehicle and consent.' }, 400)
    const photos = form.getAll('photos')
    if (photos.length !== 1) return privateReply({ error: 'Upload one driver portrait photo.' }, 400)
    const images: Uint8Array[] = []
    for (const photo of photos) {
      if (typeof photo === 'string' || photo.type !== 'image/jpeg') return privateReply({ error: 'Upload a compressed JPEG driver portrait.' }, 400)
      const image = new Uint8Array(await photo.arrayBuffer())
      if (!validHotelJpeg(image)) return privateReply({ error: 'Invalid or oversized driver portrait.' }, 400)
      images.push(image)
    }
    const photoHashes = await Promise.all(images.map(async (image) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', image)), (byte) => byte.toString(16).padStart(2, '0')).join('')))
    const data = parsed.data
    const payloadHash = await hashText(JSON.stringify({ data, photoHashes }))
    const receipt = async (row: DriverRow, status = 200) => privateReply({ saved: true, id: row.id, driverId: row.driver_id, status: row.status, accessCode: await driverAccessCode(env.ENQUIRY_ACCESS_SECRET!, row.driver_id) }, status)
    const existing = await DB.prepare(`SELECT ${driverColumns} FROM driver_registrations WHERE id = ? OR phone = ?`).bind(data.id, data.phone).first<DriverRow>()
    if (existing) return existing.id === data.id && existing.payload_hash === payloadHash ? await receipt(existing) : privateReply({ error: 'Phone or submission ID already registered. Use private status lookup or contact AVELOF.' }, 409)
    const uploadId = crypto.randomUUID()
    for (const [index, image] of images.entries()) {
      const key = `drivers/${data.id}/${uploadId}/${index}.jpg`
      keys.push(key)
      await saveRegistrationPhoto(DB, key, image)
    }
    const { id, phone, age, licenceNumber, vehicleNumber, publicationConsent, website, ...details } = data
    void publicationConsent; void website
    insertingId = id
    const row = await DB.prepare(`INSERT INTO driver_registrations (id, driver_id, phone, private_json, details_json, photo_keys_json, submitted_price, price, publication_consent, payload_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?) ON CONFLICT DO NOTHING RETURNING ${driverColumns}`)
      .bind(id, `AVELOF_DRV_${id.replaceAll('-', '').toUpperCase()}`, phone, JSON.stringify({ phone, age, licenceNumber, vehicleNumber }), JSON.stringify(details), JSON.stringify(keys), details.price, details.price, payloadHash).first<DriverRow>()
    if (!row) {
      await deleteRegistrationPhotos(DB, keys); keys = []
      const concurrent = await DB.prepare(`SELECT ${driverColumns} FROM driver_registrations WHERE id = ?`).bind(id).first<DriverRow>()
      return concurrent?.payload_hash === payloadHash ? await receipt(concurrent) : privateReply({ error: 'Phone or submission ID was just registered.' }, 409)
    }
    saved = true
    queueOwnerPush(env, waitUntil, { title: 'New driver registration', body: 'A driver and vehicle are awaiting approval.', url: '/admin/panel/drivers', tag: `driver-${id}` })
    return await receipt(row, 201)
  } catch (error) {
    console.error('Driver registration request failed', error)
    if (!saved && keys.length) {
      try {
        const row = insertingId ? await DB.prepare('SELECT photo_keys_json FROM driver_registrations WHERE id = ?').bind(insertingId).first<{ photo_keys_json: string }>() : null
        const persisted = row ? z.array(z.string()).parse(JSON.parse(row.photo_keys_json)) : []
        await deleteRegistrationPhotos(DB, keys.filter((key) => !persisted.includes(key)))
      } catch (cleanupError) { console.error('Driver photo cleanup could not be completed in D1', cleanupError) }
    }
    return privateReply({ error: 'Driver registration could not be confirmed. Retry with the same form.' }, 503)
  }
}
