import { hotelLookupSchema } from '../../src/services/hotelSchema.ts'
import { allowAccessAttempt, equalHashes, privateReply, sameOrigin } from '../_lib/enquiryAccess.ts'
import { indianPhoneNumber } from '../../src/services/phoneNumbers.ts'
import { hotelAccessCode, hotelColumns, limitedBody, publicHotel } from '../_lib/hotelRegistration.ts'
import type { HotelEnv, HotelRow } from '../_lib/hotelRegistration.ts'

export const onRequest: PagesFunction<HotelEnv> = async ({ request, env }) => {
  if (request.method !== 'POST') return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'POST' })
  if (!sameOrigin(request)) return privateReply({ error: 'Origin not allowed.' }, 403)
  if (!env.DB) return privateReply({ error: 'Hotel status lookup is unavailable.' }, 503)
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return privateReply({ error: 'JSON required.' }, 415)
  try {
    if (!await allowAccessAttempt(request, env.DB, 'hotel-lookup', 10)) return privateReply({ error: 'Too many attempts. Try again in ten minutes.' }, 429)
    const body = await limitedBody(request, 2000)
    if (body === null) return privateReply({ error: 'Lookup too large.' }, 413)
    let input: unknown
    try { input = JSON.parse(new TextDecoder().decode(body)) } catch { return privateReply({ error: 'Invalid lookup details.' }, 400) }
    const parsed = hotelLookupSchema.safeParse(input)
    if (!parsed.success) return privateReply({ error: 'Enter your hotel ID or phone number and status access code.' }, 400)
    const identifier = parsed.data.identifier.toUpperCase()
    const phone = indianPhoneNumber(identifier)
    if (!phone && !/^AVELOF_HTL_[A-F0-9]{32}$/.test(identifier)) return privateReply({ error: 'Enter a valid hotel ID or Indian phone number.' }, 400)
    const row = await env.DB.prepare(`SELECT ${hotelColumns} FROM hotel_registrations WHERE hotel_id = ? OR phone = ?`).bind(identifier, phone || null).first<HotelRow>()
    if (!row || !equalHashes(hotelAccessCode(row), parsed.data.accessCode)) return privateReply({ error: 'No matching hotel and access code. Check your details.' }, 404)
    const { photos, averageRating, reviewCount, ...hotel } = publicHotel(row)
    void photos; void averageRating; void reviewCount
    return privateReply({ hotel: { ...hotel, status: row.status } })
  } catch (error) {
    console.error('Private hotel lookup failed', error)
    return privateReply({ error: 'Could not load your hotel status. Please try again.' }, 503)
  }
}
