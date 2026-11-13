import { isAdmin, privateReply } from '../../../_lib/enquiryAccess.ts'
import { photoKeys } from '../../../_lib/hotelRegistration.ts'
import type { HotelEnv, HotelRow } from '../../../_lib/hotelRegistration.ts'

export const onRequest: PagesFunction<HotelEnv> = async ({ request, env, params }) => {
  if (!['GET', 'HEAD'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, HEAD' })
  const { id, index } = params
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || typeof index !== 'string' || !/^[0-4]$/.test(index)) return privateReply({ error: 'Photo not found.' }, 404)
  if (!env.DB || !env.HOTEL_PHOTOS) return privateReply({ error: 'Hotel photo storage is unavailable.' }, 503)
  try {
    const row = await env.DB.prepare('SELECT id, status, photo_keys_json FROM hotel_registrations WHERE id = ?').bind(id).first<Pick<HotelRow, 'id' | 'status' | 'photo_keys_json'>>()
    if (!row || (row.status !== 'approved' && !await isAdmin(request, env))) return privateReply({ error: 'Photo not found.' }, 404)
    const key = photoKeys(row)[Number(index)]
    if (!key) return privateReply({ error: 'Photo not found.' }, 404)
    const object = await env.HOTEL_PHOTOS.get(key)
    if (!object) { console.error('Registered hotel photo missing from R2', { id, index }); return privateReply({ error: 'Hotel photo is unavailable.' }, 503) }
    return new Response(request.method === 'HEAD' ? null : object.body, { headers: {
      'Content-Type': 'image/jpeg', 'Content-Length': String(object.size),
      'Cache-Control': 'private, no-store', 'Vary': 'Cookie',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
    } })
  } catch (error) {
    console.error('Hotel photo request failed', error)
    return privateReply({ error: 'Hotel photo is temporarily unavailable.' }, 503)
  }
}
