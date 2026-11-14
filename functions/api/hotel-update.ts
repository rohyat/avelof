import { z } from 'zod'
import { hotelEditAuthSchema, hotelSubmissionSchema, validHotelRoomRates } from '../../src/services/hotelSchema.ts'
import { hotelPhotoCount, hotelUploadLimit } from '../../src/data/hotelRegistration.ts'
import { allowAccessAttempt, equalHashes, hashText, privateReply, sameOrigin } from '../_lib/enquiryAccess.ts'
import { deleteRegistrationPhotos, hotelAccessCode, hotelColumns, limitedBody, photoKeys, saveRegistrationPhoto, validHotelJpeg } from '../_lib/hotelRegistration.ts'
import type { HotelEnv, HotelRow } from '../_lib/hotelRegistration.ts'
import { queueOwnerPush } from '../_lib/pushNotifications.ts'

export const onRequest: PagesFunction<HotelEnv> = async ({ request, env, waitUntil }) => {
  if (request.method !== 'POST') return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'POST' })
  if (!sameOrigin(request)) return privateReply({ error: 'Origin not allowed.' }, 403)
  if (!env.DB) return privateReply({ error: 'Hotel update storage is unavailable.' }, 503)
  if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data;')) return privateReply({ error: 'A hotel update form is required.' }, 415)
  const DB = env.DB
  const uploadedKeys: string[] = []
  let registrationId: string | null = null
  let saved = false
  try {
    if (!await allowAccessAttempt(request, DB, 'hotel-lookup', 10)) return privateReply({ error: 'Too many attempts. Try again in ten minutes.' }, 429)
    const bytes = await limitedBody(request, hotelUploadLimit)
    if (bytes === null) return privateReply({ error: 'Hotel update too large.' }, 413)
    let form: FormData
    try { form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('Content-Type')! } }).formData() }
    catch { return privateReply({ error: 'Invalid hotel update form.' }, 400) }
    if ([...form.keys()].some((key) => !['details', 'auth', 'photos'].includes(key)) || form.getAll('details').length !== 1 || form.getAll('auth').length !== 1) return privateReply({ error: 'Unexpected hotel update fields.' }, 400)
    let details: unknown, auth: unknown
    try { details = JSON.parse(String(form.get('details'))); auth = JSON.parse(String(form.get('auth'))) }
    catch { return privateReply({ error: 'Invalid hotel update details.' }, 400) }
    const parsed = hotelSubmissionSchema.safeParse(details)
    const credentials = hotelEditAuthSchema.safeParse(auth)
    if (!parsed.success || !credentials.success || !validHotelRoomRates(parsed.data) || parsed.data.website || (parsed.data.breakfastPrice === undefined) !== (parsed.data.dinnerPrice === undefined) || parsed.data.breakfastPrice !== undefined && parsed.data.mealPlan !== 'Room only') return privateReply({ error: 'Check hotel details, room rates, phone and publication consent.' }, 400)
    const data = parsed.data
    if (!/[\p{L}\p{N}]/u.test(data.name.normalize('NFKD'))) return privateReply({ error: 'Enter a hotel name containing a letter or number for your status access code.' }, 400)
    registrationId = data.id
    const current = await DB.prepare(`SELECT ${hotelColumns} FROM hotel_registrations WHERE id = ?`).bind(data.id).first<HotelRow>()
    const photos = form.getAll('photos')
    if (photos.length > hotelPhotoCount) return privateReply({ error: 'Upload at most five replacement photos.' }, 400)
    const images: Uint8Array[] = []
    for (const photo of photos) {
      if (typeof photo === 'string' || photo.type !== 'image/jpeg') return privateReply({ error: 'Replacement photos must be compressed JPEG images.' }, 400)
      const image = new Uint8Array(await photo.arrayBuffer())
      if (!validHotelJpeg(image)) return privateReply({ error: 'Invalid replacement hotel photo.' }, 400)
      images.push(image)
    }
    const photoHashes = await Promise.all(images.map(async (image) => {
      const digest = await crypto.subtle.digest('SHA-256', image)
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    }))
    const payloadHash = await hashText(JSON.stringify({ operation: 'hotel-update', data, auth: credentials.data, photoHashes }))
    const receipt = (row: HotelRow) => privateReply({ saved: true, id: row.id, hotelId: row.hotel_id, accessCode: hotelAccessCode(row), status: row.status })
    if (current?.version === credentials.data.version + 1 && current.payload_hash === payloadHash) return receipt(current)
    if (!current || !equalHashes(hotelAccessCode(current), credentials.data.accessCode)) return privateReply({ error: 'No matching hotel and access code. Check your details.' }, 404)
    if (current.version !== credentials.data.version) return privateReply({ error: 'This hotel changed. Check your status again before editing.' }, 409)
    const duplicate = await DB.prepare('SELECT id FROM hotel_registrations WHERE phone = ? AND id != ?').bind(data.phone, data.id).first<{ id: string }>()
    if (duplicate) return privateReply({ error: 'This phone number is already registered to another hotel.' }, 409)
    const uploadId = crypto.randomUUID()
    for (const [index, image] of images.entries()) {
      const key = `hotels/${data.id}/${uploadId}/${index}.jpg`
      uploadedKeys.push(key)
      await saveRegistrationPhoto(DB, key, image)
    }
    const { id, phone, contactName, publicationConsent, website, ...publicDetails } = data
    void publicationConsent; void website
    const row = await DB.prepare(`UPDATE hotel_registrations SET phone = ?, contact_name = ?, details_json = ?, photo_keys_json = ?, submitted_price = ?, price = ?, status = 'pending', owner_note = '', publication_consent = 1, payload_hash = ?, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM hotel_registrations WHERE phone = ? AND id != ?) RETURNING ${hotelColumns}`)
      .bind(phone, contactName, JSON.stringify(publicDetails), images.length ? JSON.stringify(uploadedKeys) : current.photo_keys_json, data.price, data.price, payloadHash, id, credentials.data.version, phone, id).first<HotelRow>()
    if (!row) {
      await deleteRegistrationPhotos(DB, uploadedKeys)
      uploadedKeys.length = 0
      return privateReply({ error: 'This hotel changed or the phone number is already registered. Check your status again before editing.' }, 409)
    }
    saved = true
    if (images.length) waitUntil(deleteRegistrationPhotos(DB, photoKeys(current)).catch((error: unknown) => { console.error('Replaced hotel photo cleanup failed', error) }))
    queueOwnerPush(env, waitUntil, { title: 'Hotel registration updated', body: 'Updated hotel details are awaiting approval.', url: '/admin/panel/hotels', tag: `hotel-${id}` })
    return receipt(row)
  } catch (error) {
    console.error('Private hotel update failed', error)
    if (!saved && uploadedKeys.length) {
      try {
        const row = await DB.prepare('SELECT photo_keys_json FROM hotel_registrations WHERE id = ?').bind(registrationId).first<{ photo_keys_json: string }>()
        const persisted = row ? z.array(z.string()).parse(JSON.parse(row.photo_keys_json)) : []
        await deleteRegistrationPhotos(DB, uploadedKeys.filter((key) => !persisted.includes(key)))
      } catch (cleanupError) { console.error('Hotel update photo cleanup failed', cleanupError) }
    }
    return privateReply({ error: 'Your hotel update could not be confirmed. Retry with the same form or check your status again.' }, 503)
  }
}
