import { z } from 'zod'
import { driverEditAuthSchema, driverEditDetailsSchema, driverPrivateSchema, driverSubmissionSchema, driverVehicleNumberSchema } from '../../src/services/driverSchema.ts'
import { hotelLookupSchema, hotelModerationSchema } from '../../src/services/hotelSchema.ts'
import { hotelUploadLimit } from '../../src/data/hotelRegistration.ts'
import { indianPhoneNumber } from '../../src/services/phoneNumbers.ts'
import { accessConfigured, allowAccessAttempt, equalHashes, hashText, isAdmin, privateReply, sameOrigin } from '../_lib/enquiryAccess.ts'
import { adminDriver, driverAccessCode, driverColumns, driverPhotoKeys, publicDriver } from '../_lib/driverRegistration.ts'
import type { DriverRow } from '../_lib/driverRegistration.ts'
import { deleteRegistrationPhotos, limitedBody, saveRegistrationPhoto, validHotelJpeg } from '../_lib/hotelRegistration.ts'
import type { HotelEnv } from '../_lib/hotelRegistration.ts'
import { queueOwnerPush } from '../_lib/pushNotifications.ts'

const listSchema = z.object({ scope: z.enum(['public', 'admin']).default('public'), page: z.coerce.number().int().min(1).max(10000).default(1), id: z.uuidv4().optional(), driverId: z.string().regex(/^AVELOF-DRV-[0-9]{5,10}$/).optional(), status: z.enum(['all', 'pending', 'approved', 'rejected']).default('all') }).strict()
const moderationSchema = hotelModerationSchema.omit({ price: true, breakfastPrice: true, dinnerPrice: true, roomRates: true }).extend({ vehicleNumber: driverVehicleNumberSchema })
const deletionSchema = z.object({ id: z.uuidv4(), version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict()
const legacyDriverId = (id: string) => `AVELOF_DRV_${id.replaceAll('-', '').toUpperCase()}`

async function findPrivateDriver(DB: D1Database, identifier: string, accessCode: string) {
  const normalized = identifier.toUpperCase()
  const phone = indianPhoneNumber(normalized)
  if (!phone && !/^AVELOF-DRV-[0-9]{5,10}$/.test(normalized)) return { error: 'Invalid driver ID or phone.', status: 400 } as const
  const row = await DB.prepare(`SELECT ${driverColumns} FROM driver_registrations WHERE driver_id = ? OR phone = ?`).bind(normalized, phone || null).first<DriverRow>()
  if (!row || !equalHashes(driverAccessCode(row), accessCode)) return { error: 'No matching driver and access code.', status: 404 } as const
  return { row } as const
}

async function assignDriverId(DB: D1Database, row: DriverRow) {
  await DB.prepare('INSERT INTO driver_reference_numbers (registration_id, legacy_driver_id) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM driver_reference_numbers WHERE registration_id = ?)')
    .bind(row.id, legacyDriverId(row.id), row.id).run()
  await DB.prepare("UPDATE driver_registrations SET driver_id = 'AVELOF-DRV-' || printf('%05d', (SELECT number + 10000 FROM driver_reference_numbers WHERE registration_id = ?)) WHERE id = ?")
    .bind(row.id, row.id).run()
  return DB.prepare(`SELECT ${driverColumns} FROM driver_registrations WHERE id = ?`).bind(row.id).first<DriverRow>()
}

async function registrationReceipt(DB: D1Database, row: DriverRow, status = 200) {
  const assigned = await assignDriverId(DB, row)
  if (!assigned || !/^AVELOF-DRV-[0-9]{5,10}$/.test(assigned.driver_id)) return privateReply({ error: 'Driver ID could not be assigned.' }, 503)
  return privateReply({ saved: true, id: assigned.id, driverId: assigned.driver_id, status: assigned.status, accessCode: driverAccessCode(assigned) }, status)
}

export const onRequest: PagesFunction<HotelEnv> = async ({ request, env, waitUntil }) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, PATCH, DELETE' })
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
    if (request.method === 'PATCH' || request.method === 'DELETE' || request.headers.get('Content-Type')?.split(';')[0] === 'application/json') {
      if ((request.method === 'PATCH' || request.method === 'DELETE') && !await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return privateReply({ error: 'JSON required.' }, 415)
      if (request.method === 'POST' && !await allowAccessAttempt(request, DB, 'driver-lookup', 10)) return privateReply({ error: 'Too many attempts. Try again in ten minutes.' }, 429)
      const bytes = await limitedBody(request, 12000)
      if (bytes === null) return privateReply({ error: 'Request too large.' }, 413)
      let input: unknown
      try { input = JSON.parse(new TextDecoder().decode(bytes)) } catch { return privateReply({ error: 'Invalid driver request.' }, 400) }
      if (request.method === 'DELETE') {
        const parsed = deletionSchema.safeParse(input)
        if (!parsed.success) return privateReply({ error: 'Invalid driver deletion.' }, 400)
        const deleted = await DB.prepare('DELETE FROM driver_registrations WHERE id = ? AND version = ? RETURNING id').bind(parsed.data.id, parsed.data.version).first<{ id: string }>()
        if (!deleted) return privateReply({ error: 'This driver changed or is no longer available. Refresh before deleting it.' }, 409)
        return privateReply({ deleted: true, id: deleted.id })
      }
      if (request.method === 'PATCH') {
        const parsed = moderationSchema.safeParse(input)
        if (!parsed.success) return privateReply({ error: 'Check driver vehicle registration, status and note.' }, 400)
        const { id, version, status, ownerNote, vehicleNumber } = parsed.data
        const row = await DB.prepare(`UPDATE driver_registrations SET status = ?, owner_note = ?, private_json = json_set(private_json, '$.vehicleNumber', ?), version = version + 1 WHERE id = ? AND version = ? RETURNING ${driverColumns}`).bind(status, ownerNote, vehicleNumber, id, version).first<DriverRow>()
        return row ? privateReply({ driver: adminDriver(row) }) : privateReply({ error: 'This driver changed. Refresh before updating.' }, 409)
      }
      const parsed = hotelLookupSchema.safeParse(input)
      if (!parsed.success) return privateReply({ error: 'Enter driver ID or phone and status access code.' }, 400)
      const found = await findPrivateDriver(DB, parsed.data.identifier, parsed.data.accessCode)
      if ('error' in found) return privateReply({ error: found.error }, found.status)
      const row = found.row
      const { photo, averageRating, reviewCount, ...driver } = publicDriver(row)
      void photo; void averageRating; void reviewCount
      return privateReply({ driver: { ...driver, ...driverPrivateSchema.parse(JSON.parse(row.private_json)), status: row.status, version: row.version } })
    }
    if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data;')) return privateReply({ error: 'A driver form with photos is required.' }, 415)
    // The form type is only known after parsing; this coarse cap protects parsing
    // while the separate registration and lookup limits are enforced below.
    if (!await allowAccessAttempt(request, DB, 'driver-multipart', 100)) return privateReply({ error: 'Too many attempts. Try again in ten minutes.' }, 429)
    const bytes = await limitedBody(request, hotelUploadLimit)
    if (bytes === null) return privateReply({ error: 'Driver portrait upload is too large.' }, 413)
    let form: FormData
    try { form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('Content-Type')! } }).formData() } catch { return privateReply({ error: 'Invalid driver form.' }, 400) }
    if (form.has('auth')) {
      if (!await allowAccessAttempt(request, DB, 'driver-lookup', 10)) return privateReply({ error: 'Too many attempts. Try again in ten minutes.' }, 429)
      if ([...form.keys()].some((key) => !['auth', 'details', 'photos'].includes(key)) || form.getAll('auth').length !== 1 || form.getAll('details').length !== 1 || form.getAll('photos').length > 1) return privateReply({ error: 'Unexpected driver fields.' }, 400)
      let authInput: unknown
      let detailsInput: unknown
      try { authInput = JSON.parse(String(form.get('auth'))); detailsInput = JSON.parse(String(form.get('details'))) } catch { return privateReply({ error: 'Invalid driver edit.' }, 400) }
      const auth = driverEditAuthSchema.safeParse(authInput)
      const parsed = driverEditDetailsSchema.safeParse(detailsInput)
      if (!auth.success || !parsed.success || parsed.data.website) return privateReply({ error: 'Check driver credentials, details, age, licence, vehicle and consent.' }, 400)
      if (!/[\p{L}\p{N}]/u.test(parsed.data.fullName.normalize('NFKD'))) return privateReply({ error: 'Enter a name containing a letter or number for your status access code.' }, 400)
      const photos = form.getAll('photos')
      const images: Uint8Array[] = []
      if (photos.length) {
        const photo = photos[0]
        if (typeof photo === 'string' || photo.type !== 'image/jpeg') return privateReply({ error: 'Upload a compressed JPEG driver portrait.' }, 400)
        const image = new Uint8Array(await photo.arrayBuffer())
        if (!validHotelJpeg(image)) return privateReply({ error: 'Invalid or oversized driver portrait.' }, 400)
        images.push(image)
      }
      const photoHashes = await Promise.all(images.map(async (image) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', image)), (byte) => byte.toString(16).padStart(2, '0')).join('')))
      const identifier = indianPhoneNumber(auth.data.identifier) || auth.data.identifier.toUpperCase()
      const proof = { identifier, accessCode: auth.data.accessCode, version: auth.data.version }
      const data = parsed.data
      const payloadHash = await hashText(JSON.stringify({ edit: data, auth: proof, photoHashes }))
      const receipt = (row: DriverRow) => privateReply({ saved: true, id: row.id, driverId: row.driver_id, status: row.status, accessCode: driverAccessCode(row) })
      const replay = (row: DriverRow | null) => Boolean(row && row.version === auth.data.version + 1 && equalHashes(row.payload_hash, payloadHash))
      if (/^AVELOF-DRV-[0-9]{5,10}$/.test(identifier)) {
        const current = await DB.prepare(`SELECT ${driverColumns} FROM driver_registrations WHERE driver_id = ?`).bind(identifier).first<DriverRow>()
        if (current && replay(current)) return receipt(current)
      }
      const found = await findPrivateDriver(DB, identifier, auth.data.accessCode)
      if ('error' in found) {
        if (/^AVELOF-DRV-[0-9]{5,10}$/.test(identifier)) {
          const current = await DB.prepare(`SELECT ${driverColumns} FROM driver_registrations WHERE driver_id = ?`).bind(identifier).first<DriverRow>()
          if (current && replay(current)) return receipt(current)
        }
        return privateReply({ error: found.error }, found.status)
      }
      const existing = found.row
      if (/^AVELOF-DRV-[0-9]{5,10}$/.test(identifier) && replay(existing)) return receipt(existing)
      if (existing.version !== auth.data.version) return privateReply({ error: 'This driver changed. Look up your status again before editing.' }, 409)
      insertingId = existing.id
      if (images.length) {
        const key = `drivers/${existing.id}/${crypto.randomUUID()}/0.jpg`
        keys.push(key)
        await saveRegistrationPhoto(DB, key, images[0])
      }
      const oldKeys = driverPhotoKeys(existing)
      const { phone, age, licenceNumber, vehicleNumber, publicationConsent, website, ...details } = data
      void publicationConsent; void website
      const updated = await DB.prepare(`UPDATE driver_registrations SET phone = ?, private_json = ?, details_json = ?, photo_keys_json = ?, status = 'pending', owner_note = '', version = version + 1, payload_hash = ?, directory_credentials_consent = 1, directory_credentials_consented_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM driver_registrations WHERE phone = ? AND id != ?) RETURNING ${driverColumns}`)
        .bind(phone, JSON.stringify({ phone, age, licenceNumber, vehicleNumber }), JSON.stringify(details), JSON.stringify(keys.length ? keys : oldKeys), payloadHash, existing.id, auth.data.version, phone, existing.id).first<DriverRow>()
      if (!updated) {
        await deleteRegistrationPhotos(DB, keys); keys = []
        const current = await DB.prepare(`SELECT ${driverColumns} FROM driver_registrations WHERE id = ?`).bind(existing.id).first<DriverRow>()
        if (/^AVELOF-DRV-[0-9]{5,10}$/.test(identifier) && current && replay(current)) return receipt(current)
        return privateReply({ error: !current || current.version !== auth.data.version ? 'This driver changed. Look up your status again before editing.' : 'Phone number already registered. Use another number or contact AVELOF.' }, 409)
      }
      saved = true
      keys = []
      if (photos.length) {
        try { await deleteRegistrationPhotos(DB, oldKeys) } catch (cleanupError) { console.error('Old driver photo cleanup failed', cleanupError) }
      }
      queueOwnerPush(env, waitUntil, { title: 'Driver registration updated', body: 'A driver and vehicle are awaiting approval.', url: '/admin/panel/drivers', tag: `driver-${updated.id}` })
      return receipt(updated)
    }
    if (!accessConfigured(env)) return privateReply({ error: 'Private partner access is not configured.' }, 503)
    if (!await allowAccessAttempt(request, DB, 'driver-submit', 5)) return privateReply({ error: 'Too many registrations. Try again in ten minutes.' }, 429)
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
    const existing = await DB.prepare(`SELECT ${driverColumns} FROM driver_registrations WHERE id = ? OR phone = ?`).bind(data.id, data.phone).first<DriverRow>()
    if (existing) return existing.id === data.id && existing.payload_hash === payloadHash ? await registrationReceipt(DB, existing) : privateReply({ error: 'Phone or submission ID already registered. Use private status lookup or contact AVELOF.' }, 409)
    const uploadId = crypto.randomUUID()
    for (const [index, image] of images.entries()) {
      const key = `drivers/${data.id}/${uploadId}/${index}.jpg`
      keys.push(key)
      await saveRegistrationPhoto(DB, key, image)
    }
    const { id, phone, age, licenceNumber, vehicleNumber, publicationConsent, website, ...details } = data
    void publicationConsent; void website
    insertingId = id
    const row = await DB.prepare(`INSERT INTO driver_registrations (id, driver_id, phone, private_json, details_json, photo_keys_json, publication_consent, payload_hash, directory_credentials_consent, directory_credentials_consented_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT DO NOTHING RETURNING ${driverColumns}`)
      .bind(id, legacyDriverId(id), phone, JSON.stringify({ phone, age, licenceNumber, vehicleNumber }), JSON.stringify(details), JSON.stringify(keys), payloadHash).first<DriverRow>()
    if (!row) {
      await deleteRegistrationPhotos(DB, keys); keys = []
      const concurrent = await DB.prepare(`SELECT ${driverColumns} FROM driver_registrations WHERE id = ?`).bind(id).first<DriverRow>()
      return concurrent?.payload_hash === payloadHash ? await registrationReceipt(DB, concurrent) : privateReply({ error: 'Phone or submission ID was just registered.' }, 409)
    }
    const response = await registrationReceipt(DB, row, 201)
    saved = true
    if (response.ok) queueOwnerPush(env, waitUntil, { title: 'New driver registration', body: 'A driver and vehicle are awaiting approval.', url: '/admin/panel/drivers', tag: `driver-${id}` })
    return response
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
