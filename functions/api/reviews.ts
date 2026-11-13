import { z } from 'zod'
import { reviewStatusSchema, reviewSubmissionSchema } from '../../src/services/reviewSchema.ts'
import { allowAccessAttempt, hashText, isAdmin, privateReply, sameOrigin } from '../_lib/enquiryAccess.ts'
import { queueOwnerPush } from '../_lib/pushNotifications.ts'
import type { AccessEnv } from '../_lib/enquiryAccess.ts'

interface ReviewRow {
  id: string
  reviewer_name: string
  booking_id: string
  experience: string
  rating: number
  title: string
  review_text: string
  status: 'pending' | 'published' | 'rejected'
  version: number
  created_at: string
  published_at: string | null
  submission_source: 'guest_submission' | 'owner_provided'
  review_month: string | null
  driver_id: string | null
  payload_hash?: string
}

const columns = 'id, reviewer_name, booking_id, experience, rating, title, review_text, status, version, created_at, published_at, submission_source, review_month, driver_id'
const listSchema = z.object({
  scope: z.enum(['public', 'admin']).default('public'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  status: z.union([z.literal('all'), reviewStatusSchema]).default('pending'),
  driverId: z.string().regex(/^AVELOF_DRV_[A-F0-9]{32}$/).optional(),
}).strict()
const moderationSchema = z.object({ id: z.uuidv4(), status: reviewStatusSchema, version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict()
const deletionSchema = z.object({ id: z.uuidv4(), version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict()

function publicReview(row: ReviewRow) {
  return { id: row.id, reviewerName: row.reviewer_name, bookingId: row.booking_id, experience: row.experience, rating: row.rating, title: row.title, reviewText: row.review_text, publishedAt: row.published_at, reviewMonth: row.review_month, driverId: row.driver_id }
}

function adminReview(row: ReviewRow) {
  return { ...publicReview(row), status: row.status, version: row.version, createdAt: row.created_at, submissionSource: row.submission_source }
}

async function readBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    bytes += value.byteLength
    if (bytes > 12288) { await reader.cancel(); return null }
    text += decoder.decode(value, { stream: true })
  }
}

export const onRequest: PagesFunction<AccessEnv> = async ({ request, env, waitUntil }) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, PATCH, DELETE' })
  if (request.method !== 'GET' && !sameOrigin(request)) return privateReply({ error: 'Origin not allowed.' }, 403)
  if (!env.DB) return privateReply({ error: 'Review storage is unavailable.' }, 503)
  try {
    if (request.method === 'GET') {
      const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
      if (!parsed.success) return privateReply({ error: 'Invalid review filters.' }, 400)
      const { scope, page, status, driverId } = parsed.data
      if (scope === 'admin' && !await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      const admin = scope === 'admin'
      const where = admin ? "WHERE (? = 'all' OR status = ?) AND (? IS NULL OR driver_id = ?)" : "WHERE status = 'published' AND (? IS NULL OR driver_id = ?)"
      const values = admin ? [status, status, driverId ?? null, driverId ?? null] : [driverId ?? null, driverId ?? null]
      const totals = await env.DB.prepare(`SELECT count(*) AS total, avg(rating) AS averageRating FROM reviews ${where}`).bind(...values).first<{ total: number; averageRating: number | null }>()
      const result = await env.DB.prepare(`SELECT ${columns} FROM reviews ${where} ORDER BY ${admin ? 'created_at DESC' : "COALESCE(review_month, substr(published_at, 1, 7)) DESC, published_at DESC"}, id DESC LIMIT 25 OFFSET ?`).bind(...values, (page - 1) * 25).all<ReviewRow>()
      return privateReply({ reviews: result.results.map(admin ? adminReview : publicReview), total: totals?.total ?? 0, averageRating: totals?.averageRating ?? null, page, pageSize: 25 })
    }
    if ((request.method === 'PATCH' || request.method === 'DELETE') && !await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return privateReply({ error: 'JSON required.' }, 415)
    if (Number(request.headers.get('Content-Length')) > 12288) return privateReply({ error: 'Review too large.' }, 413)
    const text = await readBody(request)
    if (text === null) return privateReply({ error: 'Review too large.' }, 413)
    let input: unknown
    try { input = JSON.parse(text) } catch { return privateReply({ error: 'Invalid review details.' }, 400) }
    if (request.method === 'DELETE') {
      const parsed = deletionSchema.safeParse(input)
      if (!parsed.success) return privateReply({ error: 'Invalid review deletion.' }, 400)
      const deleted = await env.DB.prepare('DELETE FROM reviews WHERE id = ? AND version = ? RETURNING id').bind(parsed.data.id, parsed.data.version).first<{ id: string }>()
      if (!deleted) return privateReply({ error: 'This review changed or is no longer available. Refresh before deleting it.' }, 409)
      return privateReply({ deleted: true, id: deleted.id })
    }
    if (request.method === 'PATCH') {
      const parsed = moderationSchema.safeParse(input)
      if (!parsed.success) return privateReply({ error: 'Invalid review update.' }, 400)
      const { id, status, version } = parsed.data
      const row = await env.DB.prepare(`UPDATE reviews SET status = ?, version = version + 1, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ELSE NULL END WHERE id = ? AND version = ? RETURNING ${columns}`)
        .bind(status, status, id, version).first<ReviewRow>()
      if (!row) return privateReply({ error: 'This review changed or is no longer available. Refresh before updating it.' }, 409)
      return privateReply({ review: adminReview(row) })
    }
    const parsed = reviewSubmissionSchema.safeParse(input)
    if (!parsed.success || parsed.data.website) return privateReply({ error: 'Check your review details and consent.' }, 400)
    const { id, reviewerName, bookingId, experience, rating, title, reviewText, driverId } = parsed.data
    if (driverId) {
      const driver = await env.DB.prepare("SELECT driver_id FROM driver_registrations WHERE driver_id = ? AND status = 'approved'").bind(driverId).first<{ driver_id: string }>()
      if (!driver) return privateReply({ error: 'This driver is not available for public reviews.' }, 404)
    }
    const payloadHash = await hashText(JSON.stringify({ reviewerName, bookingId, experience, rating, title, reviewText, ...(driverId ? { driverId } : {}), publicationConsent: true }))
    const existing = await env.DB.prepare('SELECT status, payload_hash FROM reviews WHERE id = ?').bind(id).first<ReviewRow>()
    if (existing) return existing.payload_hash === payloadHash
      ? privateReply({ saved: true, id, status: existing.status })
      : privateReply({ error: 'This submission ID has already been used. Start a new review.' }, 409)
    if (!await allowAccessAttempt(request, env.DB, 'review-submit', 3)) return privateReply({ error: 'Too many reviews. Please try again in ten minutes.' }, 429, { 'Retry-After': '600' })
    const inserted = await env.DB.prepare("INSERT INTO reviews (id, reviewer_name, booking_id, experience, rating, title, review_text, driver_id, publication_consent, payload_hash, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT (id) DO NOTHING")
      .bind(id, reviewerName, bookingId, experience, rating, title, reviewText, driverId || null, payloadHash).run()
    const saved = await env.DB.prepare('SELECT status, payload_hash FROM reviews WHERE id = ?').bind(id).first<ReviewRow>()
    if (!saved || saved.payload_hash !== payloadHash) return privateReply({ error: 'Review could not be saved with this ID.' }, 409)
    if (Number(inserted.meta?.changes ?? 0) > 0) queueOwnerPush(env, waitUntil, {
      title: 'New guest review',
      body: `1 new review · ${rating} ${rating === 1 ? 'star' : 'stars'}`,
      url: '/admin/panel/reviews',
      tag: `review-${id}`,
    })
    return privateReply({ saved: true, id, status: saved.status }, 201)
  } catch {
    return privateReply({ error: 'Reviews are temporarily unavailable. Please try again.' }, 503)
  }
}