import { z } from 'zod'
import { adminReviewSchema, publicReviewSchema, reviewStatusSchema } from './reviewSchema'
import type { ReviewStatus, ReviewSubmission } from './reviewSchema'

const pagination = { total: z.number().int().min(0), averageRating: z.number().nullable(), page: z.number().int().min(1), pageSize: z.literal(25) }
const publicList = z.object({ ...pagination, reviews: z.array(publicReviewSchema) })
const adminList = z.object({ ...pagination, reviews: z.array(adminReviewSchema) })

export class ReviewError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function requestReviews(query = '', method = 'GET', body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`/api/reviews${query}`, {
    method, cache: 'no-store', credentials: 'same-origin',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Reviews could not be loaded. Please try again.'
    throw new ReviewError(message, response.status)
  }
  return data
}

export async function saveReview(submission: ReviewSubmission) {
  const receipt = z.object({ saved: z.literal(true), id: z.uuidv4(), status: reviewStatusSchema }).parse(await requestReviews('', 'POST', submission))
  if (receipt.id !== submission.id) throw new Error('Review storage could not be confirmed. Please try again.')
  return receipt
}

export async function loadPublicReviews(page: number, signal?: AbortSignal, subject: { driverId?: string; hotelId?: string } = {}) {
  const query = new URLSearchParams({ page: String(page), ...subject })
  return publicList.parse(await requestReviews(`?${query}`, 'GET', undefined, signal))
}

export async function loadAdminReviews(page: number, status: ReviewStatus | 'all', signal?: AbortSignal, subject: { category?: 'guest' | 'driver' | 'hotel'; driverId?: string; hotelId?: string } = {}) {
  return adminList.parse(await requestReviews(`?${new URLSearchParams({ scope: 'admin', page: String(page), status, ...subject })}`, 'GET', undefined, signal))
}

export async function moderateReview(id: string, status: ReviewStatus, version: number) {
  return z.object({ review: adminReviewSchema }).parse(await requestReviews('', 'PATCH', { id, status, version })).review
}

export async function deleteReview(id: string, version: number) {
  return z.object({ deleted: z.literal(true), id: z.uuidv4() }).parse(await requestReviews('', 'DELETE', { id, version }))
}