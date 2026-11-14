import { z } from 'zod'
import { businessDetailsSchema } from '../../src/services/businessSchema.ts'
import type { AccessEnv } from './enquiryAccess.ts'
import { partnerStatusAccessCode } from '../../src/services/partnerAccessCode.ts'

export interface BusinessEnv extends AccessEnv {}

export interface BusinessRow {
  id: string
  contact_name: string
  contact_phone: string
  contact_email: string
  details_json: string
  photo_key: string
  photo_keys_json: string
  status: 'pending' | 'approved' | 'rejected'
  version: number
  owner_note: string
  payload_hash: string
  created_at: string
  latitude: number | null
  longitude: number | null
}

export const businessColumns = 'id, contact_name, contact_phone, contact_email, details_json, photo_key, photo_keys_json, status, version, owner_note, payload_hash, created_at, latitude, longitude'
export const businessPhotoKeys = (row: Pick<BusinessRow, 'photo_key' | 'photo_keys_json'>) =>
  z.array(z.string().regex(/^businesses\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[0-4]\.jpg$/)).min(1).max(5).parse(JSON.parse(row.photo_keys_json))

export function businessAccessCode(row: BusinessRow) {
  return partnerStatusAccessCode(businessDetailsSchema.parse(JSON.parse(row.details_json)).name, row.contact_phone)
}

export function businessReceipt(row: BusinessRow) {
  return { saved: true, id: row.id, status: row.status, accessCode: businessAccessCode(row) }
}

export function ownerBusiness(row: BusinessRow) {
  const { photo, photos, ...details } = publicBusiness(row)
  void photo; void photos
  return { ...details, contactName: row.contact_name, contactPhone: row.contact_phone, contactEmail: row.contact_email, status: row.status, version: row.version }
}

export function publicBusiness(row: BusinessRow) {
  const { latitude: _latitude, longitude: _longitude, ...details } = businessDetailsSchema.parse(JSON.parse(row.details_json))
  return {
    ...details,
    ...(row.latitude != null && row.longitude != null ? { latitude: row.latitude, longitude: row.longitude } : {}),
    id: row.id,
    photo: `/api/business-images/${row.id}`,
    photos: businessPhotoKeys(row).map((_, index) => `/api/business-images/${row.id}?index=${index}`),
  }
}

export function adminBusiness(row: BusinessRow) {
  return {
    ...publicBusiness(row),
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    status: row.status,
    version: row.version,
    ownerNote: row.owner_note,
    createdAt: row.created_at,
  }
}
