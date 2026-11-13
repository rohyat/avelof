import { z } from 'zod'
import { hotelDetailsSchema } from '../../src/services/hotelSchema.ts'
import { hotelPhotoCount, hotelPhotoDimension, hotelPhotoLimit } from '../../src/data/hotelRegistration.ts'
import { customerAccessCode } from './enquiryAccess.ts'
import type { AccessEnv } from './enquiryAccess.ts'

export interface HotelEnv extends AccessEnv {}
export interface HotelRow {
  id: string; hotel_id: string; phone: string; contact_name: string;
  details_json: string; photo_keys_json: string; submitted_price: number; price: number;
  status: 'pending' | 'approved' | 'rejected'; version: number; owner_note: string;
  payload_hash: string; created_at: string; updated_at: string;
  average_rating?: number | null; review_count?: number;
}
export const hotelColumns = 'id, hotel_id, phone, contact_name, details_json, photo_keys_json, submitted_price, price, status, version, owner_note, payload_hash, created_at, updated_at'
export const photoKeys = (row: Pick<HotelRow, 'photo_keys_json'>) => z.array(z.string().regex(/^hotels\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[0-4]\.jpg$/)).min(1).max(hotelPhotoCount).parse(JSON.parse(row.photo_keys_json))
export function publicHotel(row: HotelRow) {
  return {
    ...hotelDetailsSchema.parse(JSON.parse(row.details_json)), id: row.id, hotelId: row.hotel_id, price: row.price,
    photos: photoKeys(row).map((_, index) => `/api/hotel-images/${row.id}/${index}`),
    averageRating: row.average_rating ?? null, reviewCount: row.review_count ?? 0,
  }
}
export function adminHotel(row: HotelRow) {
  return { ...publicHotel(row), contactName: row.contact_name, phone: row.phone, submittedPrice: row.submitted_price, status: row.status, version: row.version, ownerNote: row.owner_note, createdAt: row.created_at, updatedAt: row.updated_at }
}
export const hotelAccessCode = (secret: string, hotelId: string) => customerAccessCode(secret, `hotel:${hotelId}`)

export async function limitedBody(request: Request, limit: number) {
  if (Number(request.headers.get('Content-Length')) > limit) return null
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > limit) { await reader.cancel(); return null }
    chunks.push(value)
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length }
  return body
}

export function validHotelJpeg(bytes: Uint8Array) {
  if (bytes.length < 20 || bytes.length > hotelPhotoLimit || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return false
  let offset = 2
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return false
    const marker = bytes[offset + 1]
    const length = bytes[offset + 2] * 256 + bytes[offset + 3]
    if (length < 2 || offset + length + 2 > bytes.length) return false
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) return false
      const height = bytes[offset + 5] * 256 + bytes[offset + 6]
      const width = bytes[offset + 7] * 256 + bytes[offset + 8]
      return height > 0 && width > 0 && height <= hotelPhotoDimension && width <= hotelPhotoDimension
    }
    if (marker === 0xda) return false
    offset += length + 2
  }
  return false
}

export function registrationPhotoBytes(content: unknown) {
  if (content instanceof ArrayBuffer) return new Uint8Array(content)
  if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
  if (Array.isArray(content) && content.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) return new Uint8Array(content)
  throw new TypeError('Registration photo content is not a valid byte sequence.')
}

export async function saveRegistrationPhoto(DB: D1Database, key: string, image: Uint8Array) {
  const content = new Uint8Array(image).buffer
  await DB.prepare('INSERT INTO registration_photos (photo_key, content) VALUES (?, ?)').bind(key, content).run()
}

export async function deleteRegistrationPhotos(DB: D1Database, keys: string[]) {
  if (!keys.length) return
  try {
    for (const key of keys) await DB.prepare('DELETE FROM registration_photos WHERE photo_key = ?').bind(key).run()
  } catch (error) {
    console.error('Registration photo cleanup failed', error)
    throw error
  }
}
