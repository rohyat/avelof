import { z } from 'zod'
import { businessKinds, businessLocations, businessUploadLimit } from '../../src/data/businessRegistration.ts'
import { businessDeletionSchema, businessEditAuthSchema, businessModerationSchema, businessSubmissionSchema } from '../../src/services/businessSchema.ts'
import { hotelLookupSchema } from '../../src/services/hotelSchema.ts'
import { indianPhoneNumber } from '../../src/services/phoneNumbers.ts'
import { accessConfigured, allowAccessAttempt, equalHashes, hashText, isAdmin, privateReply, sameOrigin } from '../_lib/enquiryAccess.ts'
import { adminBusiness, businessAccessCode, businessColumns, businessPhotoKeys, businessReceipt, ownerBusiness, publicBusiness } from '../_lib/businessRegistration.ts'
import type { BusinessEnv, BusinessRow } from '../_lib/businessRegistration.ts'
import { limitedBody, validHotelJpeg } from '../_lib/hotelRegistration.ts'
import { readRetainedPhotos, retainedPhotoKeys } from '../_lib/partnerPhotos.ts'

const listSchema = z.object({
  scope: z.enum(['public', 'admin']).default('public'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  kind: z.enum(businessKinds).optional(),
  location: z.enum(businessLocations).optional(),
  status: z.enum(['all', 'pending', 'approved', 'rejected']).default('all'),
}).strict()

export const onRequest: PagesFunction<BusinessEnv> = async ({ request, env }) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, PATCH, DELETE' })
  if (request.method !== 'GET' && !sameOrigin(request)) return privateReply({ error: 'Origin not allowed.' }, 403)
  if (!env.DB) return privateReply({ error: 'Business registration storage is unavailable.' }, 503)
  const DB = env.DB
  let submittingId = ''
  let submittingHash = ''

  try {
    if (request.method === 'GET') {
      const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
      if (!parsed.success) return privateReply({ error: 'Invalid business filters.' }, 400)
      const { scope, page, kind, location, status } = parsed.data
      const admin = scope === 'admin'
      if (admin && !await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      const where = admin
        ? "WHERE (? = 'all' OR status = ?) AND (? IS NULL OR json_extract(details_json, '$.kind') = ?) AND (? IS NULL OR json_extract(details_json, '$.location') = ?)"
        : "WHERE status = 'approved' AND (? IS NULL OR json_extract(details_json, '$.kind') = ?) AND (? IS NULL OR json_extract(details_json, '$.location') = ?)"
      const values = admin
        ? [status, status, kind ?? null, kind ?? null, location ?? null, location ?? null]
        : [kind ?? null, kind ?? null, location ?? null, location ?? null]
      const total = await DB.prepare(`SELECT count(*) AS total FROM business_registrations ${where}`).bind(...values).first<{ total: number }>()
      const rows = await DB.prepare(`SELECT ${businessColumns} FROM business_registrations ${where} ORDER BY created_at DESC, id DESC LIMIT 25 OFFSET ?`)
        .bind(...values, (page - 1) * 25).all<BusinessRow>()
      return privateReply({
        businesses: rows.results.map(admin ? adminBusiness : publicBusiness),
        total: total?.total ?? 0,
        page,
        pageSize: 25,
      })
    }

    if (request.method === 'PATCH' || request.method === 'DELETE') {
      if (!await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return privateReply({ error: 'JSON required.' }, 415)
      const bytes = await limitedBody(request, 12000)
      if (bytes === null) return privateReply({ error: 'Business update too large.' }, 413)
      let input: unknown
      try { input = JSON.parse(new TextDecoder().decode(bytes)) } catch { return privateReply({ error: 'Invalid business update.' }, 400) }

      if (request.method === 'DELETE') {
        const parsed = businessDeletionSchema.safeParse(input)
        if (!parsed.success) return privateReply({ error: 'Invalid business deletion.' }, 400)
        const deleted = await DB.prepare('DELETE FROM business_registrations WHERE id = ? AND version = ? RETURNING id')
          .bind(parsed.data.id, parsed.data.version).first<{ id: string }>()
        if (!deleted) return privateReply({ error: 'This business changed or is no longer available. Refresh before deleting it.' }, 409)
        return privateReply({ deleted: true, id: deleted.id })
      }

      const parsed = businessModerationSchema.safeParse(input)
      if (!parsed.success) return privateReply({ error: 'Check the public business details, listing status and moderation note.' }, 400)
      const { id, version, status, ownerNote, latitude, longitude, ...details } = parsed.data
      const row = await DB.prepare(`UPDATE business_registrations SET details_json = ?, status = ?, owner_note = ?, latitude = CASE WHEN ? THEN ? ELSE latitude END, longitude = CASE WHEN ? THEN ? ELSE longitude END, version = version + 1 WHERE id = ? AND version = ? RETURNING ${businessColumns}`)
        .bind(JSON.stringify(details), status, ownerNote, latitude !== undefined ? 1 : 0, latitude ?? null, longitude !== undefined ? 1 : 0, longitude ?? null, id, version).first<BusinessRow>()
      return row
        ? privateReply({ business: adminBusiness(row) })
        : privateReply({ error: 'This business changed. Refresh before updating it.' }, 409)
    }

    if (request.headers.get('Content-Type')?.split(';')[0] === 'application/json') {
      if (!await allowAccessAttempt(request, DB, 'business-lookup', 10)) return privateReply({ error: 'Too many attempts. Try again in ten minutes.' }, 429)
      const bytes = await limitedBody(request, 2000)
      if (bytes === null) return privateReply({ error: 'Lookup too large.' }, 413)
      let input: unknown
      try { input = JSON.parse(new TextDecoder().decode(bytes)) } catch { return privateReply({ error: 'Invalid lookup details.' }, 400) }
      const parsed = hotelLookupSchema.safeParse(input)
      if (!parsed.success) return privateReply({ error: 'Enter your business ID or phone number and status access code.' }, 400)
      const phone = indianPhoneNumber(parsed.data.identifier)
      const id = parsed.data.identifier.toLowerCase()
      if (!phone && !z.uuidv4().safeParse(id).success) return privateReply({ error: 'Enter a valid business ID or Indian phone number.' }, 400)
      const rows = await DB.prepare(`SELECT ${businessColumns} FROM business_registrations WHERE id = ? OR contact_phone = ? LIMIT 26`).bind(id, phone || null).all<BusinessRow>()
      const matching = rows.results.filter((row) => equalHashes(businessAccessCode(row), parsed.data.accessCode))
      if (rows.results.length > 25 || matching.length > 1) return privateReply({ error: 'Please use your business ID and access code to identify this listing.' }, 400)
      if (matching.length !== 1) return privateReply({ error: 'No matching business and access code. Check your details.' }, 404)
      return privateReply({ business: ownerBusiness(matching[0]) })
    }

    if (!accessConfigured(env)) return privateReply({ error: 'Business registration is not configured.' }, 503)
    if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data;')) return privateReply({ error: 'A business registration form with a photo is required.' }, 415)
    if (!await allowAccessAttempt(request, DB, 'business-lookup', 10)) return privateReply({ error: 'Too many attempts. Try again in ten minutes.' }, 429, { 'Retry-After': '600' })
    const bytes = await limitedBody(request, businessUploadLimit)
    if (bytes === null) return privateReply({ error: 'Business photo is too large. Use the registration form to compress it.' }, 413)
    let form: FormData
    try { form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('Content-Type')! } }).formData() }
    catch { return privateReply({ error: 'Invalid business registration form.' }, 400) }
    const editing = form.has('auth')
    if (!editing && !await allowAccessAttempt(request, DB, 'business-submit', 5)) return privateReply({ error: 'Too many submissions. Try again in ten minutes.' }, 429)
    if ([...form.keys()].some((key) => !['details', 'photo', 'auth', ...(editing ? ['retainedPhotos'] : [])].includes(key)) || form.getAll('details').length !== 1 || editing && form.getAll('auth').length !== 1 || !editing && form.getAll('photo').length < 1 || form.getAll('photo').length > 5) return privateReply({ error: 'Provide business details and 1-5 photos, or keep existing photos when editing.' }, 400)
    const retained = readRetainedPhotos(form)
    if (!retained.success) return privateReply({ error: 'Invalid retained photos.' }, 400)
    let authInput: unknown
    try { authInput = editing ? JSON.parse(String(form.get('auth'))) : undefined } catch { return privateReply({ error: 'Invalid update credentials.' }, 400) }
    const auth = businessEditAuthSchema.safeParse(authInput)
    if (editing && !auth.success) return privateReply({ error: 'Check your business status access code and version.' }, 400)

    let input: unknown
    try { input = JSON.parse(String(form.get('details'))) } catch { return privateReply({ error: 'Invalid business details.' }, 400) }
    const parsed = businessSubmissionSchema.safeParse(input)
    if (!parsed.success || parsed.data.websiteTrap) return privateReply({ error: 'Check your business details and publication consent.' }, 400)
    const images: Uint8Array[] = []
    for (const photo of form.getAll('photo')) {
      if (!(photo instanceof File) || photo.type !== 'image/jpeg') return privateReply({ error: 'Upload compressed JPEG photos.' }, 400)
      const image = new Uint8Array(await photo.arrayBuffer())
      if (!validHotelJpeg(image)) return privateReply({ error: 'Each business photo must be a valid JPEG under 1 MB and 1920 pixels per side.' }, 400)
      images.push(image)
    }
    const data = parsed.data
    const photoDigests = await Promise.all(images.map(async (image) => {
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(image).buffer))
      return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
    }))
    const photoDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(photoDigests))))
    const photoHash = images.length === 1 ? photoDigests[0] : Array.from(photoDigest, (byte) => byte.toString(16).padStart(2, '0')).join('')
    const { items, ...legacyData } = data
    const payloadHash = await hashText(JSON.stringify(editing ? { operation: 'business-update', data, auth: auth.data, photoDigests, ...(retained.data === undefined ? {} : { retainedPhotos: retained.data }) } : { operation: 'business-submit', data: items.length ? data : legacyData, photoHash }))
    submittingId = data.id
    submittingHash = payloadHash
    const existing = await DB.prepare(`SELECT ${businessColumns} FROM business_registrations WHERE id = ?`).bind(data.id).first<BusinessRow>()
    if (editing && auth.success) {
      if (existing?.version === auth.data.version + 1 && existing.payload_hash === payloadHash) return privateReply(businessReceipt(existing))
      if (!existing || !equalHashes(businessAccessCode(existing), auth.data.accessCode)) return privateReply({ error: 'No matching business and access code. Check your details.' }, 404)
      if (existing.version !== auth.data.version) return privateReply({ error: 'This business changed. Check your status again before editing.' }, 409)
    }
    if (existing) {
      if (!editing && existing.payload_hash === payloadHash) return privateReply(businessReceipt(existing))
      if (!editing) return privateReply({ error: 'This registration request was already used. Refresh the form and submit again.' }, 409)
    }

    const uploadId = crypto.randomUUID()
    const newKeys = images.map((_, index) => `businesses/${data.id}/${uploadId}/${index}.jpg`)
    const keptKeys = editing && existing ? retainedPhotoKeys(businessPhotoKeys(existing), retained.data, images.length) : []
    if (!keptKeys) return privateReply({ error: 'Keep or upload between one and five business photos.' }, 400)
    const uploadedKeys = [...keptKeys, ...newKeys]
    const uploadedKey = uploadedKeys[0]
    const registrationKey = JSON.stringify([data.kind, data.location, data.name, data.address].map((value) => value.trim().toLowerCase()))
    const { id, contactName, contactPhone, contactEmail, publicationConsent, websiteTrap, latitude, longitude, ...details } = data
    void publicationConsent
    void websiteTrap
    if (editing && auth.success && existing) {
      const duplicate = await DB.prepare('SELECT id FROM business_registrations WHERE registration_key = ? AND id != ?').bind(registrationKey, id).first<{ id: string }>()
      if (duplicate) return privateReply({ error: 'These business details already belong to another listing.' }, 409)
      await DB.batch([
        DB.prepare("UPDATE business_registrations SET registration_key = ?, contact_name = ?, contact_phone = ?, contact_email = ?, details_json = ?, photo_key = ?, photo_keys_json = ?, latitude = CASE WHEN ? THEN ? ELSE latitude END, longitude = CASE WHEN ? THEN ? ELSE longitude END, status = 'pending', owner_note = '', publication_consent = 1, payload_hash = ?, version = version + 1 WHERE id = ? AND version = ?")
          .bind(registrationKey, contactName, contactPhone, contactEmail, JSON.stringify(details), uploadedKey, JSON.stringify(uploadedKeys), latitude !== undefined ? 1 : 0, latitude ?? null, longitude !== undefined ? 1 : 0, longitude ?? null, payloadHash, id, auth.data.version),
        ...images.map((image, index) => DB.prepare('INSERT INTO registration_photos (photo_key, content) SELECT ?, ? WHERE EXISTS (SELECT 1 FROM business_registrations WHERE id = ? AND payload_hash = ? AND version = ? AND photo_keys_json = ?)')
          .bind(newKeys[index], new Uint8Array(image).buffer, id, payloadHash, auth.data.version + 1, JSON.stringify(uploadedKeys))),
        ...businessPhotoKeys(existing).filter((key) => !keptKeys.includes(key)).map((key) => DB.prepare('DELETE FROM registration_photos WHERE photo_key = ? AND EXISTS (SELECT 1 FROM business_registrations WHERE id = ? AND payload_hash = ? AND version = ? AND photo_keys_json = ?)')
          .bind(key, id, payloadHash, auth.data.version + 1, JSON.stringify(uploadedKeys))),
      ])
      const row = await DB.prepare(`SELECT ${businessColumns} FROM business_registrations WHERE id = ?`).bind(id).first<BusinessRow>()
      if (!row || row.payload_hash !== payloadHash || row.version !== auth.data.version + 1) return privateReply({ error: 'This business changed. Check your status again before editing.' }, 409)
      return privateReply(businessReceipt(row))
    }
    // D1 batches are transactional: a failed photo write must not leave a registration without its photo.
    await DB.batch([
      DB.prepare('INSERT INTO business_registrations (id, registration_key, contact_name, contact_phone, contact_email, details_json, photo_key, photo_keys_json, publication_consent, payload_hash, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?) ON CONFLICT DO NOTHING')
        .bind(id, registrationKey, contactName, contactPhone, contactEmail, JSON.stringify(details), uploadedKey, JSON.stringify(uploadedKeys), payloadHash, latitude ?? null, longitude ?? null),
      ...images.map((image, index) => DB.prepare('INSERT INTO registration_photos (photo_key, content) SELECT ?, ? WHERE EXISTS (SELECT 1 FROM business_registrations WHERE id = ? AND photo_key = ?)')
        .bind(uploadedKeys[index], new Uint8Array(image).buffer, id, uploadedKey)),
    ])
    const row = await DB.prepare(`SELECT ${businessColumns} FROM business_registrations WHERE id = ?`).bind(id).first<BusinessRow>()
    if (!row || row.payload_hash !== payloadHash) return privateReply({ error: 'This business or registration request is already registered. Contact AVELOF for help with an existing listing.' }, 409)
    return privateReply(businessReceipt(row), 201)
  } catch (error) {
    console.error('Business registration request failed', error)
    if (submittingId && submittingHash) {
      try {
        const persisted = await DB.prepare(`SELECT ${businessColumns} FROM business_registrations WHERE id = ?`).bind(submittingId).first<BusinessRow>()
        if (persisted?.payload_hash === submittingHash) return privateReply(businessReceipt(persisted))
      } catch (lookupError) { console.error('Business registration recovery lookup failed', lookupError) }
    }
    return privateReply({ error: 'The business request could not be confirmed. Retry with the same unchanged form.' }, 503)
  }
}
