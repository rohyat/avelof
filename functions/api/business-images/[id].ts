import { isAdmin, privateReply } from '../../_lib/enquiryAccess.ts'
import { businessPhotoKeys } from '../../_lib/businessRegistration.ts'
import type { BusinessEnv, BusinessRow } from '../../_lib/businessRegistration.ts'
import { registrationPhotoBytes, validHotelJpeg } from '../../_lib/hotelRegistration.ts'
import { z } from 'zod'
import { businessDetailsSchema } from '../../../src/services/businessSchema.ts'

export const onRequest: PagesFunction<BusinessEnv> = async ({ request, env, params }) => {
  if (!['GET', 'HEAD'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, HEAD' })
  const { id } = params
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return privateReply({ error: 'Photo not found.' }, 404)
  if (!env.DB) return privateReply({ error: 'Business photo storage is unavailable.' }, 503)
  try {
    const url = new URL(request.url)
    const item = url.searchParams.get('item')
    if (item !== null && (!z.uuidv4().safeParse(item).success || url.searchParams.has('index'))) return privateReply({ error: 'Photo not found.' }, 404)
    const index = url.searchParams.get('index') ?? '0'
    if (!/^[0-4]$/.test(index)) return privateReply({ error: 'Photo not found.' }, 404)
    const row = await env.DB.prepare('SELECT status, photo_key, photo_keys_json, details_json FROM business_registrations WHERE id = ?').bind(id).first<Pick<BusinessRow, 'status' | 'photo_key' | 'photo_keys_json' | 'details_json'>>()
    if (!row || (row.status !== 'approved' && !await isAdmin(request, env))) return privateReply({ error: 'Photo not found.' }, 404)
    const key = businessPhotoKeys(row)[Number(index)]
    if (item && !businessDetailsSchema.parse(JSON.parse(row.details_json)).items.some((entry) => typeof entry !== 'string' && entry.id === item)) return privateReply({ error: 'Photo not found.' }, 404)
    if (!item && !key) return privateReply({ error: 'Photo not found.' }, 404)
    const object = item
      ? await env.DB.prepare('SELECT content FROM business_item_photos WHERE business_id = ? AND item_id = ?').bind(id, item).first<{ content: unknown }>()
      : await env.DB.prepare('SELECT content FROM registration_photos WHERE photo_key = ?').bind(key).first<{ content: unknown }>()
    if (!object) { console.error('Registered business photo missing from D1', { id }); return privateReply({ error: 'Business photo is unavailable.' }, 503) }
    const bytes = registrationPhotoBytes(object.content)
    if (!validHotelJpeg(bytes)) throw new TypeError('Stored business photo is not a valid JPEG.')
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, no-store',
      'Vary': 'Cookie',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
    } })
  } catch (error) {
    console.error('Business photo request failed', error)
    return privateReply({ error: 'Business photo is temporarily unavailable.' }, 503)
  }
}
