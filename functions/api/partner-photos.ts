import { z } from 'zod'
import { partnerStatusAccessCodePattern } from '../../src/services/partnerAccessCode.ts'
import { allowAccessAttempt, equalHashes, privateReply, sameOrigin } from '../_lib/enquiryAccess.ts'
import { hotelAccessCode, hotelColumns, limitedBody, photoKeys, registrationPhotoBytes, validHotelJpeg } from '../_lib/hotelRegistration.ts'
import type { HotelEnv, HotelRow } from '../_lib/hotelRegistration.ts'
import { driverAccessCode, driverColumns, driverPhotoKeys } from '../_lib/driverRegistration.ts'
import type { DriverRow } from '../_lib/driverRegistration.ts'
import { businessAccessCode, businessColumns, businessPhotoKeys } from '../_lib/businessRegistration.ts'
import type { BusinessRow } from '../_lib/businessRegistration.ts'
import { businessDetailsSchema } from '../../src/services/businessSchema.ts'

const inputSchema = z.object({
  kind: z.enum(['hotel', 'driver', 'business']), id: z.uuidv4(),
  accessCode: z.string().trim().toUpperCase().regex(partnerStatusAccessCodePattern),
  version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  itemPhotos: z.literal(true).optional(),
}).strict()

export const onRequest: PagesFunction<HotelEnv> = async ({ request, env }) => {
  if (request.method !== 'POST') return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'POST' })
  if (!sameOrigin(request)) return privateReply({ error: 'Origin not allowed.' }, 403)
  if (!env.DB) return privateReply({ error: 'Photo storage is unavailable.' }, 503)
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return privateReply({ error: 'JSON required.' }, 415)
  try {
    if (!await allowAccessAttempt(request, env.DB, 'partner-photo-lookup', 10)) return privateReply({ error: 'Too many photo requests. Try again in ten minutes.' }, 429)
    const bytes = await limitedBody(request, 2000)
    if (bytes === null) return privateReply({ error: 'Photo request too large.' }, 413)
    let input: unknown
    try { input = JSON.parse(new TextDecoder().decode(bytes)) } catch { return privateReply({ error: 'Invalid photo request.' }, 400) }
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return privateReply({ error: 'Check your registration and access code.' }, 400)
    const { kind, id, accessCode, version, itemPhotos } = parsed.data
    if (itemPhotos && kind !== 'business') return privateReply({ error: 'Item photos are only available for businesses.' }, 400)
    let itemIds: string[] = []
    let keys: string[]
    let currentVersion: number
    if (kind === 'hotel') {
      const row = await env.DB.prepare(`SELECT ${hotelColumns} FROM hotel_registrations WHERE id = ?`).bind(id).first<HotelRow>()
      if (!row || !equalHashes(hotelAccessCode(row), accessCode)) return privateReply({ error: 'No matching registration and access code.' }, 404)
      keys = photoKeys(row); currentVersion = row.version
    } else if (kind === 'driver') {
      const row = await env.DB.prepare(`SELECT ${driverColumns} FROM driver_registrations WHERE id = ?`).bind(id).first<DriverRow>()
      if (!row || !equalHashes(driverAccessCode(row), accessCode)) return privateReply({ error: 'No matching registration and access code.' }, 404)
      keys = driverPhotoKeys(row); currentVersion = row.version
    } else {
      const row = await env.DB.prepare(`SELECT ${businessColumns} FROM business_registrations WHERE id = ?`).bind(id).first<BusinessRow>()
      if (!row || !equalHashes(businessAccessCode(row), accessCode)) return privateReply({ error: 'No matching registration and access code.' }, 404)
      keys = businessPhotoKeys(row); currentVersion = row.version
      if (itemPhotos) itemIds = businessDetailsSchema.parse(JSON.parse(row.details_json)).items.flatMap((item) => typeof item === 'string' ? [] : [item.id])
    }
    if (version !== currentVersion) return privateReply({ error: 'This registration changed. Check your status again before editing photos.' }, 409)
    if (itemPhotos) {
      const items: Record<string, string> = {}
      for (const itemId of itemIds) {
        const row = await env.DB.prepare('SELECT content FROM business_item_photos WHERE business_id = ? AND item_id = ?').bind(id, itemId).first<{ content: unknown }>()
        if (!row) throw new Error('Registered item photo is missing.')
        const image = registrationPhotoBytes(row.content)
        if (!validHotelJpeg(image)) throw new Error('Registered item photo is invalid.')
        let binary = ''
        for (let index = 0; index < image.length; index += 8192) binary += String.fromCharCode(...image.subarray(index, index + 8192))
        items[itemId] = `data:image/jpeg;base64,${btoa(binary)}`
      }
      return privateReply({ itemPhotos: items })
    }
    const photos = []
    for (const key of keys) {
      const row = await env.DB.prepare('SELECT content FROM registration_photos WHERE photo_key = ?').bind(key).first<{ content: unknown }>()
      if (!row) throw new Error('Registered photo is missing.')
      const image = registrationPhotoBytes(row.content)
      if (!validHotelJpeg(image)) throw new Error('Registered photo is invalid.')
      let binary = ''
      for (let index = 0; index < image.length; index += 8192) binary += String.fromCharCode(...image.subarray(index, index + 8192))
      photos.push(`data:image/jpeg;base64,${btoa(binary)}`)
    }
    return privateReply({ photos })
  } catch (error) {
    console.error('Private partner photo lookup failed', error)
    return privateReply({ error: 'Could not load your existing photos. Please retry before editing.' }, 503)
  }
}
