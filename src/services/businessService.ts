import { z } from 'zod'
import { businessAdminListSchema, businessDetailsSchema, businessListSchema, businessOwnerSchema, businessReceiptSchema } from './businessSchema'
import type { AdminBusiness, BusinessDetails, BusinessEditAuth, BusinessKind, BusinessStatus, BusinessSubmission, PublicBusiness } from './businessSchema'

export class BusinessError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

export function businessErrorText(error: unknown) {
  return error instanceof BusinessError ? error.message : 'The business request could not be confirmed. Please try again.'
}

async function requestBusiness(url: string, method = 'GET', body?: FormData | Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
  const multipart = body instanceof FormData
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body), ...(multipart ? {} : { headers: { 'Content-Type': 'application/json' } }) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
  })
  if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
    if (response.ok) throw new BusinessError('The business registration API is not connected to this preview. Run npm run build, then npm run dev:cloudflare, and open the Pages preview URL.', 503)
    throw new BusinessError(`The business service is unavailable (HTTP ${response.status}). Please try again later or contact AVELOF.`, response.status)
  }
  const data: unknown = await response.json().catch(() => null)
  if (data === null) throw new BusinessError('The business service returned an invalid response. Please try again or contact AVELOF.', 502)
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'The business request failed. Please try again.'
    throw new BusinessError(message, response.status)
  }
  return data
}

export async function compressBusinessPhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5000000) throw new BusinessError('Use a JPEG, PNG or WebP photo no larger than 5 MB.', 400)
  let image: ImageBitmap
  try { image = await createImageBitmap(file) }
  catch { throw new BusinessError(`Could not read ${file.name}. Choose a valid photo.`, 400) }
  try {
    if (image.width * image.height > 40000000) throw new BusinessError('Photo resolution is too large. Choose a smaller image.', 400)
    const scale = Math.min(1, 1920 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new BusinessError('Photo processing is unavailable in this browser.', 503)
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    let photo: Blob | null = null
    for (const quality of [0.85, 0.78, 0.7]) {
      photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (photo && photo.size <= 350000) break
    }
    if (!photo || photo.size > 1000000) throw new BusinessError('This photo could not be compressed enough. Choose a smaller image.', 400)
    return photo
  } finally { image.close() }
}

export async function saveBusiness(details: BusinessSubmission, photos: Blob[], itemPhotos: ReadonlyMap<string, Blob> = new Map()) {
  if (photos.length < 1 || photos.length > 5) throw new BusinessError('Choose between one and five photos of your shop or restaurant and products.', 400)
  const body = new FormData()
  body.append('details', JSON.stringify(details))
  photos.forEach((photo, index) => body.append('photo', photo, `business-${index + 1}.jpg`))
  itemPhotos.forEach((photo, id) => body.append(`itemPhoto_${id}`, photo, `${id}.jpg`))
  const receipt = businessReceiptSchema.parse(await requestBusiness('/api/businesses', 'POST', body))
  if (receipt.id !== details.id) throw new BusinessError('Business registration could not be confirmed. Retry with the same form.', 503)
  return receipt
}

export async function lookupBusiness(identifier: string, accessCode: string) {
  return z.object({ business: businessOwnerSchema }).parse(await requestBusiness('/api/businesses', 'POST', { identifier, accessCode })).business
}

export async function editBusiness(details: BusinessSubmission, auth: BusinessEditAuth, photos: Blob[], retainedPhotos?: number[], itemPhotos: ReadonlyMap<string, Blob> = new Map()) {
  if (photos.length > 5) throw new BusinessError('Choose no more than five replacement photos.', 400)
  const body = new FormData()
  body.append('details', JSON.stringify(details))
  body.append('auth', JSON.stringify(auth))
  if (retainedPhotos !== undefined) body.append('retainedPhotos', JSON.stringify(retainedPhotos))
  photos.forEach((photo, index) => body.append('photo', photo, `business-${index + 1}.jpg`))
  itemPhotos.forEach((photo, id) => body.append(`itemPhoto_${id}`, photo, `${id}.jpg`))
  const receipt = businessReceiptSchema.parse(await requestBusiness('/api/businesses', 'POST', body))
  if (receipt.id !== details.id || receipt.status !== 'pending') throw new BusinessError('Business update could not be confirmed. Check your status again.', 503)
  return receipt
}

export async function loadBusinessItemPhotos(id: string, accessCode: string, version: number, signal?: AbortSignal) {
  const result = await requestBusiness('/api/partner-photos', 'POST', { kind: 'business', id, accessCode, version, itemPhotos: true }, signal)
  return z.object({ itemPhotos: z.record(z.uuidv4(), z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/)) }).parse(result).itemPhotos
}

export async function loadPublicBusinesses(filters: { kind?: BusinessKind; location?: string }, signal?: AbortSignal) {
  const businesses: PublicBusiness[] = []
  let page = 1
  while (true) {
    const query = new URLSearchParams({ page: String(page), ...(filters.kind ? { kind: filters.kind } : {}), ...(filters.location ? { location: filters.location } : {}) })
    const listing = businessListSchema.parse(await requestBusiness(`/api/businesses?${query}`, 'GET', undefined, signal))
    businesses.push(...listing.businesses)
    if (page * listing.pageSize >= listing.total) return businesses
    page++
  }
}

export async function loadAdminBusinesses(page: number, status: BusinessStatus | 'all', signal?: AbortSignal) {
  return businessAdminListSchema.parse(await requestBusiness(`/api/businesses?${new URLSearchParams({ scope: 'admin', page: String(page), status })}`, 'GET', undefined, signal))
}

export async function moderateBusiness(business: AdminBusiness, details: BusinessDetails, status: BusinessStatus, ownerNote: string) {
  const data = businessDetailsSchema.parse(details)
  return z.object({ business: businessAdminListSchema.shape.businesses.element }).parse(await requestBusiness('/api/businesses', 'PATCH', {
    id: business.id,
    version: business.version,
    status,
    ownerNote,
    ...data,
  })).business
}

export async function deleteBusiness(id: string, version: number) {
  return z.object({ deleted: z.literal(true), id: z.uuidv4() }).parse(await requestBusiness('/api/businesses', 'DELETE', { id, version }))
}
