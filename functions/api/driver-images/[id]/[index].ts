import { isAdmin, privateReply } from '../../../_lib/enquiryAccess.ts'
import { driverPhotoKeys } from '../../../_lib/driverRegistration.ts'
import type { DriverRow } from '../../../_lib/driverRegistration.ts'
import { registrationPhotoBytes, validHotelJpeg } from '../../../_lib/hotelRegistration.ts'
import type { HotelEnv } from '../../../_lib/hotelRegistration.ts'
export const onRequest: PagesFunction<HotelEnv> = async ({ request, env, params }) => {
  if (!['GET', 'HEAD'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405)
  const { id, index } = params
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || typeof index !== 'string' || !/^[0-4]$/.test(index)) return privateReply({ error: 'Photo not found.' }, 404)
  if (!env.DB) return privateReply({ error: 'Driver portraits are unavailable.' }, 503)
  try {
    const row = await env.DB.prepare('SELECT status, photo_keys_json FROM driver_registrations WHERE id = ?').bind(id).first<Pick<DriverRow, 'status' | 'photo_keys_json'>>()
    if (!row || row.status !== 'approved' && !await isAdmin(request, env)) return privateReply({ error: 'Photo not found.' }, 404)
    const key = driverPhotoKeys(row)[Number(index)]
    if (!key) return privateReply({ error: 'Photo not found.' }, 404)
    const photo = await env.DB.prepare('SELECT content FROM registration_photos WHERE photo_key = ?').bind(key).first<{ content: unknown }>()
    if (!photo) { console.error('Driver portrait missing from D1', { id, index }); return privateReply({ error: 'Driver portrait is unavailable.' }, 503) }
    const bytes = registrationPhotoBytes(photo.content)
    if (!validHotelJpeg(bytes)) throw new TypeError('Stored driver portrait is not a valid JPEG.')
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(bytes.byteLength), 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" } })
  } catch (error) { console.error('Driver portrait request failed', error); return privateReply({ error: 'Driver portrait is temporarily unavailable.' }, 503) }
}
